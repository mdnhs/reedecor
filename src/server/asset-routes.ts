import { Hono, type Context } from "hono";
import { z } from "zod";
import { assetsDb } from "@/lib/supabase/assets-db";
import { storageService } from "@/lib/storage/supabase-storage";
import { optimizeGlbBuffer } from "@/lib/storage/glb-optimizer";
import type { AppUser } from "@/lib/supabase/auth-service";
import { toMerchantView } from "@/lib/assets/access";
import { ASSET_CATEGORY_ICONS } from "@/lib/assets/types";
import {
  MAX_ASSET_BYTES,
  assetMetaSchema,
  assetUpdateSchema,
  validateGlb,
} from "@/lib/assets/validation";

type GetCurrentUser = (c: Context) => Promise<AppUser | null>;

const MAX_PREVIEW_BYTES = 1024 * 1024;
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47];

const categorySchema = z.object({
  name: z.string().trim().min(1).max(40),
  icon: z.enum(ASSET_CATEGORY_ICONS),
});

const versionMetaSchema = assetMetaSchema.pick({
  widthCm: true,
  depthCm: true,
  heightCm: true,
});

function fail(c: Context, error: string, status: 400 | 401 | 403 | 404 | 409 | 413 | 500) {
  return c.json({ success: false, error }, status);
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "unknown error";
}

interface PreparedUpload {
  glb: Buffer;
  preview: Buffer | null;
  meta: unknown;
}

async function readUpload(
  c: Context
): Promise<{ ok: true; upload: PreparedUpload } | { ok: false; response: Response }> {
  const form = await c.req.formData().catch(() => null);
  const glbFile = form?.get("glb");
  const previewFile = form?.get("preview");
  const rawMeta = form?.get("meta");

  if (!(glbFile instanceof File)) {
    return { ok: false, response: fail(c, "A GLB file is required.", 400) };
  }

  let meta: unknown;
  try {
    meta = JSON.parse(typeof rawMeta === "string" ? rawMeta : "");
  } catch {
    return { ok: false, response: fail(c, "Asset metadata must be valid JSON.", 400) };
  }

  const raw = Buffer.from(await glbFile.arrayBuffer());
  const check = validateGlb(raw);
  if (!check.ok) return { ok: false, response: fail(c, check.error, 400) };

  let glb: Buffer;
  try {
    glb = await optimizeGlbBuffer(raw, { strict: true });
  } catch (err) {
    console.error("[Assets] GLB optimization failed:", err);
    return {
      ok: false,
      response: fail(c, `The GLB file could not be read: ${errorMessage(err)}`, 400),
    };
  }
  if (glb.length > MAX_ASSET_BYTES) {
    return {
      ok: false,
      response: fail(c, "Asset is larger than 2 MB after optimization.", 413),
    };
  }

  let preview: Buffer | null = null;
  if (previewFile instanceof File) {
    preview = Buffer.from(await previewFile.arrayBuffer());
    if (!PNG_SIGNATURE.every((byte, i) => preview![i] === byte)) {
      return { ok: false, response: fail(c, "Preview must be a PNG image.", 400) };
    }
    if (preview.length > MAX_PREVIEW_BYTES) {
      return { ok: false, response: fail(c, "Preview image is larger than 1 MB.", 413) };
    }
  }

  return { ok: true, upload: { glb, preview, meta } };
}

async function storeVersionFiles(assetId: string, version: number, upload: PreparedUpload) {
  const glbResult = await storageService.uploadAssetFile(upload.glb, "glb", assetId, version);
  const previewResult = upload.preview
    ? await storageService.uploadAssetFile(upload.preview, "preview", assetId, version)
    : null;
  return {
    glbUrl: glbResult.publicUrl,
    storagePath: glbResult.path,
    previewUrl: previewResult?.publicUrl ?? null,
    fileSizeBytes: upload.glb.length,
    uploadedPaths: previewResult ? [glbResult.path, previewResult.path] : [glbResult.path],
  };
}

export function assetRoutes(getCurrentUser: GetCurrentUser) {
  const routes = new Hono();

  async function requireAdmin(c: Context): Promise<Response | null> {
    const user = await getCurrentUser(c);
    if (!user) return fail(c, "Sign in required.", 401);
    if (user.role !== "saas_admin") {
      return fail(c, "Access denied. SaaS Admin privilege required.", 403);
    }
    return null;
  }

  routes.get("/admin/asset-categories", async (c) => {
    const denied = await requireAdmin(c);
    if (denied) return denied;
    return c.json({ success: true, data: await assetsDb.listCategories() });
  });

  routes.post("/admin/asset-categories", async (c) => {
    const denied = await requireAdmin(c);
    if (denied) return denied;

    const parsed = categorySchema.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) return fail(c, "Category needs a name and a valid icon.", 400);

    try {
      const category = await assetsDb.createCategory(parsed.data.name, parsed.data.icon);
      return c.json({ success: true, data: category }, 201);
    } catch (err) {
      if (errorMessage(err) === "duplicate") {
        return fail(c, "A category with this name already exists.", 409);
      }
      return fail(c, errorMessage(err), 500);
    }
  });

  routes.delete("/admin/asset-categories/:id", async (c) => {
    const denied = await requireAdmin(c);
    if (denied) return denied;

    const result = await assetsDb.deleteCategory(c.req.param("id"));
    if (result === "in_use") {
      return fail(c, "Category still has assets. Move or hide them first.", 409);
    }
    return c.json({ success: true });
  });

  routes.get("/admin/assets", async (c) => {
    const denied = await requireAdmin(c);
    if (denied) return denied;
    return c.json({ success: true, data: await assetsDb.listAssets() });
  });

  routes.post("/admin/assets", async (c) => {
    const denied = await requireAdmin(c);
    if (denied) return denied;

    const read = await readUpload(c);
    if (!read.ok) return read.response;

    const parsed = assetMetaSchema.safeParse(read.upload.meta);
    if (!parsed.success) return fail(c, "Invalid asset details.", 400);
    const { widthCm, depthCm, heightCm, ...details } = parsed.data;

    const categories = await assetsDb.listCategories();
    if (!categories.some((cat) => cat.id === details.categoryId)) {
      return fail(c, "Unknown category.", 400);
    }

    const id = crypto.randomUUID();
    let uploadedPaths: string[] = [];
    try {
      const { uploadedPaths: paths, ...files } = await storeVersionFiles(id, 1, read.upload);
      uploadedPaths = paths;
      const created = await assetsDb.createAsset(
        { id, ...details },
        { assetId: id, ...files, widthCm, depthCm, heightCm }
      );
      return c.json({ success: true, data: created }, 201);
    } catch (err) {
      await storageService.removeAssetFiles(uploadedPaths).catch(() => undefined);
      return fail(c, `Could not save asset: ${errorMessage(err)}`, 500);
    }
  });

  routes.patch("/admin/assets/:id", async (c) => {
    const denied = await requireAdmin(c);
    if (denied) return denied;

    const parsed = assetUpdateSchema.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) return fail(c, "Invalid asset update.", 400);

    if (parsed.data.categoryId) {
      const categories = await assetsDb.listCategories();
      if (!categories.some((cat) => cat.id === parsed.data.categoryId)) {
        return fail(c, "Unknown category.", 400);
      }
    }

    try {
      const updated = await assetsDb.updateAsset(c.req.param("id"), parsed.data);
      if (!updated) return fail(c, "Asset not found.", 404);
      return c.json({ success: true, data: updated });
    } catch (err) {
      return fail(c, `Could not update asset: ${errorMessage(err)}`, 500);
    }
  });

  routes.post("/admin/assets/:id/versions", async (c) => {
    const denied = await requireAdmin(c);
    if (denied) return denied;

    const id = c.req.param("id");
    const existing = await assetsDb.getAsset(id);
    if (!existing) return fail(c, "Asset not found.", 404);

    const read = await readUpload(c);
    if (!read.ok) return read.response;

    const parsed = versionMetaSchema.safeParse(read.upload.meta);
    if (!parsed.success) return fail(c, "Invalid asset size.", 400);

    let uploadedPaths: string[] = [];
    try {
      const { uploadedPaths: paths, ...files } = await storeVersionFiles(
        id,
        existing.currentVersion.version + 1,
        read.upload
      );
      uploadedPaths = paths;
      const updated = await assetsDb.addVersion(id, { assetId: id, ...files, ...parsed.data });
      return c.json({ success: true, data: updated }, 201);
    } catch (err) {
      await storageService.removeAssetFiles(uploadedPaths).catch(() => undefined);
      if (errorMessage(err) === "version_conflict") {
        return fail(c, "Another version was created at the same time. Try again.", 409);
      }
      return fail(c, `Could not save new version: ${errorMessage(err)}`, 500);
    }
  });

  routes.get("/assets", async (c) => {
    const user = await getCurrentUser(c);
    if (!user) return fail(c, "Sign in required.", 401);
    if (user.role === "customer") {
      return fail(c, "Room assets are available to merchants and admins.", 403);
    }

    const [assets, categories] = await Promise.all([
      assetsDb.listAssets(),
      assetsDb.listCategories(),
    ]);
    const views = assets.flatMap((asset) => toMerchantView(asset, user) ?? []);
    return c.json({ success: true, data: views, categories });
  });

  return routes;
}
