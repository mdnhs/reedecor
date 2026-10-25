import { Hono, type Context } from "hono";
import { assetsDb } from "@/lib/supabase/assets-db";
import { scenesDb } from "@/lib/supabase/scenes-db";
import { supabaseDb } from "@/lib/supabase/db";
import { inMemoryStore } from "@/server/demo-store";
import type { AppUser } from "@/lib/supabase/auth-service";
import { sceneSchema } from "@/lib/scenes/schema";
import { validateSceneSave } from "@/lib/scenes/rules";
import { EMPTY_SCENE, type ResolvedScene, type SceneData } from "@/lib/scenes/types";

type GetCurrentUser = (c: Context) => Promise<AppUser | null>;

function fail(c: Context, error: string, status: 400 | 401 | 403 | 404 | 500) {
  return c.json({ success: false, error }, status);
}

async function findProduct(id: string) {
  return (await supabaseDb.getProductById(id)) || inMemoryStore.getById(id);
}

async function resolveScene(scene: SceneData): Promise<ResolvedScene> {
  const versions = await assetsDb.getVersionsWithAssets(scene.items.map((item) => item.versionId));
  return {
    schemaVersion: 1,
    backdrop: scene.backdrop,
    ...(scene.room ? { room: scene.room } : {}),
    items: scene.items.flatMap((item) => {
      const found = versions.get(item.versionId);
      if (!found) return [];
      const { version, asset } = found;
      return [
        {
          ...item,
          glbUrl: version.glbUrl,
          widthCm: version.widthCm,
          depthCm: version.depthCm,
          heightCm: version.heightCm,
          placement: asset.placement,
        },
      ];
    }),
  };
}

export function sceneRoutes(getCurrentUser: GetCurrentUser) {
  const routes = new Hono();

  routes.get("/products/:id/scene", async (c) => {
    const id = c.req.param("id");
    if (!(await findProduct(id))) return fail(c, "Product not found.", 404);

    try {
      const scene = (await scenesDb.get(id)) ?? EMPTY_SCENE;
      return c.json({ success: true, data: await resolveScene(scene) });
    } catch (err) {
      const detail = err instanceof Error ? err.message : "unknown error";
      return fail(c, `Could not load scene: ${detail}`, 500);
    }
  });

  routes.put("/products/:id/scene", async (c) => {
    const user = await getCurrentUser(c);
    if (!user) return fail(c, "Sign in required.", 401);
    if (user.role !== "saas_admin" && user.role !== "merchant") {
      return fail(c, "Only merchants and admins can edit a scene.", 403);
    }

    const id = c.req.param("id");
    const product = await findProduct(id);
    if (!product) return fail(c, "Product not found.", 404);
    if (user.role === "merchant" && product.merchantId !== user.id) {
      return fail(c, "You can only edit scenes of your own products.", 403);
    }

    const parsed = sceneSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return fail(c, "Invalid scene.", 400);

    try {
      const [previous, versions] = await Promise.all([
        scenesDb.get(id),
        assetsDb.getVersionsWithAssets(parsed.data.items.map((item) => item.versionId)),
      ]);
      const check = validateSceneSave({ next: parsed.data, previous, versions, merchant: user });
      if (!check.ok) return fail(c, check.error, check.status);

      await scenesDb.upsert(id, parsed.data, user.id);
      return c.json({ success: true, data: await resolveScene(parsed.data) });
    } catch (err) {
      const detail = err instanceof Error ? err.message : "unknown error";
      return fail(c, `Could not save scene: ${detail}`, 500);
    }
  });

  return routes;
}
