import { Hono, type Context } from "hono";
import { featuresDb } from "@/lib/supabase/features-db";
import { FEATURES, isFeatureKey, resolveFlags } from "@/lib/features/catalog";
import type { AppUser } from "@/lib/supabase/auth-service";
import { featureFlags } from "./feature-service";

type GetCurrentUser = (c: Context) => Promise<AppUser | null>;

function fail(c: Context, error: string, status: 400 | 401 | 403 | 500) {
  return c.json({ success: false, error }, status);
}

export function featureRoutes(getCurrentUser: GetCurrentUser) {
  const routes = new Hono();

  async function requireAdmin(c: Context): Promise<{ user: AppUser } | { response: Response }> {
    const user = await getCurrentUser(c);
    if (!user) return { response: fail(c, "Sign in required.", 401) };
    if (user.role !== "saas_admin") {
      return { response: fail(c, "Access denied. SaaS Admin privilege required.", 403) };
    }
    return { user };
  }

  routes.get("/features", async (c) => c.json({ success: true, data: await featureFlags.getAll() }));

  routes.get("/admin/features", async (c) => {
    const admin = await requireAdmin(c);
    if ("response" in admin) return admin.response;

    try {
      const rows = await featuresDb.list();
      const flags = resolveFlags(rows);
      const data = FEATURES.map((feature) => {
        const row = rows.find((r) => r.key === feature.key);
        return {
          ...feature,
          enabled: flags[feature.key],
          updatedAt: row?.updatedAt ?? null,
          updatedBy: row?.updatedBy ?? null,
        };
      });
      return c.json({ success: true, data });
    } catch (err) {
      const detail = err instanceof Error ? err.message : "unknown error";
      return fail(c, `Could not load feature flags: ${detail}`, 500);
    }
  });

  routes.put("/admin/features/:key", async (c) => {
    const admin = await requireAdmin(c);
    if ("response" in admin) return admin.response;

    const key = c.req.param("key");
    if (!isFeatureKey(key)) return fail(c, "Unknown feature.", 400);

    const body = await c.req.json().catch(() => null);
    if (!body || typeof body.enabled !== "boolean") {
      return fail(c, "Body must be { enabled: true | false }.", 400);
    }

    try {
      await featureFlags.set(key, body.enabled, admin.user.id);
      const feature = FEATURES.find((f) => f.key === key)!;
      return c.json({
        success: true,
        data: {
          ...feature,
          enabled: body.enabled,
          updatedAt: new Date().toISOString(),
          updatedBy: admin.user.id,
        },
      });
    } catch (err) {
      const detail = err instanceof Error ? err.message : "unknown error";
      return fail(c, `Could not save feature flag: ${detail}`, 500);
    }
  });

  return routes;
}
