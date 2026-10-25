import { describe, it, expect, vi, beforeEach } from "vitest";
import type { RoomAsset } from "../src/lib/assets/types";

const users: Record<string, { id: string; role: string; plan: string }> = {
  "admin-token": { id: "admin-1", role: "saas_admin", plan: "free" },
  "free-token": { id: "m-free", role: "merchant", plan: "free" },
  "customer-token": { id: "c-1", role: "customer", plan: "free" },
};

const mocks = vi.hoisted(() => ({
  validateSession: vi.fn(),
  assetsDb: {
    listCategories: vi.fn(),
    createCategory: vi.fn(),
    deleteCategory: vi.fn(),
    listAssets: vi.fn(),
    getAsset: vi.fn(),
    createAsset: vi.fn(),
    addVersion: vi.fn(),
    updateAsset: vi.fn(),
  },
  uploadAssetFile: vi.fn(),
  removeAssetFiles: vi.fn(),
  optimizeGlbBuffer: vi.fn(),
}));

vi.mock("@/lib/supabase/auth-service", () => ({
  authService: { validateSession: mocks.validateSession },
}));
vi.mock("@/lib/supabase/assets-db", () => ({ assetsDb: mocks.assetsDb }));
vi.mock("@/lib/storage/supabase-storage", () => ({
  storageService: {
    uploadAssetFile: mocks.uploadAssetFile,
    removeAssetFiles: mocks.removeAssetFiles,
  },
}));
vi.mock("@/lib/storage/glb-optimizer", () => ({
  optimizeGlbBuffer: mocks.optimizeGlbBuffer,
}));

import { assetRoutes } from "../src/server/asset-routes";
import { Hono } from "hono";
import { getCookie } from "hono/cookie";

const app = new Hono().basePath("/api");
app.route(
  "/",
  assetRoutes(async (c) => {
    const header = c.req.header("Authorization");
    const token = header?.startsWith("Bearer ") ? header.slice(7) : getCookie(c, "app_session");
    return token ? (mocks.validateSession(token) as never) : null;
  })
);

const version = {
  id: "v1",
  assetId: "a1",
  version: 1,
  glbUrl: "https://x/a.glb",
  storagePath: "assets/a1/v1.glb",
  previewUrl: null,
  widthCm: 40,
  depthCm: 40,
  heightCm: 120,
  fileSizeBytes: 1000,
  createdAt: "2026-10-25T00:00:00Z",
};

function asset(overrides: Partial<RoomAsset> = {}): RoomAsset {
  return {
    id: "a1",
    name: "Plant",
    categoryId: "cat-1",
    accessLevel: "free",
    placement: "floor",
    hidden: false,
    allowedMerchantIds: [],
    currentVersion: version,
    createdAt: "2026-10-25T00:00:00Z",
    updatedAt: "2026-10-25T00:00:00Z",
    ...overrides,
  };
}

function glb(length = 20) {
  const bytes = Buffer.alloc(length);
  bytes.write("glTF", 0, "ascii");
  bytes.writeUInt32LE(2, 4);
  bytes.writeUInt32LE(length, 8);
  return bytes;
}

const meta = {
  name: "Plant",
  categoryId: "cat-1",
  accessLevel: "free",
  placement: "floor",
  widthCm: 40,
  depthCm: 40,
  heightCm: 120,
};

function uploadForm(file: Buffer, fields: Record<string, unknown> = meta) {
  const form = new FormData();
  form.set("glb", new File([new Uint8Array(file)], "plant.glb"));
  form.set("meta", JSON.stringify(fields));
  return form;
}

function as(token: string, init: RequestInit = {}) {
  return { ...init, headers: { ...(init.headers ?? {}), Authorization: `Bearer ${token}` } };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.validateSession.mockImplementation(async (token: string) => users[token] ?? null);
  mocks.assetsDb.listCategories.mockResolvedValue([
    { id: "cat-1", name: "Plants", icon: "leaf", sortOrder: 0 },
  ]);
  mocks.optimizeGlbBuffer.mockImplementation(async (b: Buffer) => b);
  mocks.uploadAssetFile.mockResolvedValue({
    path: "assets/a1/v1.glb",
    publicUrl: "https://x/a.glb",
    sizeBytes: 20,
    mimeType: "model/gltf-binary",
  });
  mocks.assetsDb.createAsset.mockResolvedValue(asset());
  mocks.removeAssetFiles.mockResolvedValue(undefined);
});

describe("admin asset routes", () => {
  it("rejects anonymous and customer access to the admin asset list", async () => {
    expect((await app.request("/api/admin/assets")).status).toBe(401);
    expect((await app.request("/api/admin/assets", as("customer-token"))).status).toBe(403);
    expect((await app.request("/api/admin/assets", as("free-token"))).status).toBe(403);
  });

  it("lists every asset including hidden ones for the admin", async () => {
    mocks.assetsDb.listAssets.mockResolvedValue([asset(), asset({ id: "a2", hidden: true })]);
    const res = await app.request("/api/admin/assets", as("admin-token"));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.data).toHaveLength(2);
  });

  it("rejects a file that is not a GLB without storing anything", async () => {
    const res = await app.request(
      "/api/admin/assets",
      as("admin-token", { method: "POST", body: uploadForm(Buffer.from("not a glb at all!!")) })
    );
    expect(res.status).toBe(400);
    expect(mocks.uploadAssetFile).not.toHaveBeenCalled();
    expect(mocks.assetsDb.createAsset).not.toHaveBeenCalled();
  });

  it("rejects an optimized GLB over 2 MB without storing anything", async () => {
    mocks.optimizeGlbBuffer.mockResolvedValue(Buffer.alloc(2 * 1024 * 1024 + 1));
    const res = await app.request(
      "/api/admin/assets",
      as("admin-token", { method: "POST", body: uploadForm(glb()) })
    );
    expect(res.status).toBe(413);
    expect(mocks.uploadAssetFile).not.toHaveBeenCalled();
  });

  it("rejects invalid metadata", async () => {
    const res = await app.request(
      "/api/admin/assets",
      as("admin-token", { method: "POST", body: uploadForm(glb(), { ...meta, widthCm: 0 }) })
    );
    expect(res.status).toBe(400);
  });

  it("creates an asset from a valid upload", async () => {
    const res = await app.request(
      "/api/admin/assets",
      as("admin-token", { method: "POST", body: uploadForm(glb()) })
    );
    expect(res.status).toBe(201);
    expect(mocks.uploadAssetFile).toHaveBeenCalledWith(expect.any(Buffer), "glb", expect.any(String), 1);
    expect(mocks.assetsDb.createAsset).toHaveBeenCalled();
  });

  it("returns 409 when a new version collides", async () => {
    mocks.assetsDb.getAsset.mockResolvedValue(asset());
    mocks.assetsDb.addVersion.mockRejectedValue(new Error("version_conflict"));
    const res = await app.request(
      "/api/admin/assets/a1/versions",
      as("admin-token", {
        method: "POST",
        body: uploadForm(glb(), { widthCm: 50, depthCm: 50, heightCm: 130 }),
      })
    );
    expect(res.status).toBe(409);
  });

  it("rejects an update with an invalid access level", async () => {
    const res = await app.request(
      "/api/admin/assets/a1",
      as("admin-token", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessLevel: "nope" }),
      })
    );
    expect(res.status).toBe(400);
  });

  it("returns 404 when updating a missing asset", async () => {
    mocks.assetsDb.updateAsset.mockResolvedValue(null);
    const res = await app.request(
      "/api/admin/assets/missing",
      as("admin-token", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hidden: true }),
      })
    );
    expect(res.status).toBe(404);
  });
});

describe("asset route failure handling", () => {
  it("does not touch the allow-list when only hiding an asset", async () => {
    mocks.assetsDb.updateAsset.mockResolvedValue(asset({ hidden: true }));
    await app.request(
      "/api/admin/assets/a1",
      as("admin-token", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hidden: true }),
      })
    );
    expect(mocks.assetsDb.updateAsset).toHaveBeenCalledWith("a1", { hidden: true });
  });

  it("rejects a GLB whose body cannot be parsed and stores nothing", async () => {
    mocks.optimizeGlbBuffer.mockRejectedValue(new Error("parse failed"));
    const res = await app.request(
      "/api/admin/assets",
      as("admin-token", { method: "POST", body: uploadForm(glb()) })
    );
    expect(res.status).toBe(400);
    expect(mocks.optimizeGlbBuffer).toHaveBeenCalledWith(expect.any(Buffer), { strict: true });
    expect(mocks.uploadAssetFile).not.toHaveBeenCalled();
  });

  it("removes uploaded files when saving a new asset fails", async () => {
    mocks.assetsDb.createAsset.mockRejectedValue(new Error("db down"));
    const res = await app.request(
      "/api/admin/assets",
      as("admin-token", { method: "POST", body: uploadForm(glb()) })
    );
    expect(res.status).toBe(500);
    expect(mocks.removeAssetFiles).toHaveBeenCalledWith(["assets/a1/v1.glb"]);
  });

  it("removes uploaded files when a new version collides", async () => {
    mocks.assetsDb.getAsset.mockResolvedValue(asset());
    mocks.assetsDb.addVersion.mockRejectedValue(new Error("version_conflict"));
    await app.request(
      "/api/admin/assets/a1/versions",
      as("admin-token", {
        method: "POST",
        body: uploadForm(glb(), { widthCm: 50, depthCm: 50, heightCm: 130 }),
      })
    );
    expect(mocks.removeAssetFiles).toHaveBeenCalledWith(["assets/a1/v1.glb"]);
  });
});

describe("merchant asset listing", () => {
  it("blocks customers", async () => {
    expect((await app.request("/api/assets", as("customer-token"))).status).toBe(403);
  });

  it("locks pro assets for a free merchant, omits hidden ones and never leaks the allow-list", async () => {
    mocks.assetsDb.listAssets.mockResolvedValue([
      asset({ id: "free-1" }),
      asset({ id: "pro-1", accessLevel: "pro" }),
      asset({ id: "hidden-1", hidden: true }),
      asset({ id: "sel-1", accessLevel: "selected", allowedMerchantIds: ["m-free"] }),
    ]);
    const res = await app.request("/api/assets", as("free-token"));
    const json = await res.json();
    const byId = Object.fromEntries(json.data.map((a: { id: string }) => [a.id, a]));
    expect(Object.keys(byId).sort()).toEqual(["free-1", "pro-1", "sel-1"]);
    expect(byId["free-1"].locked).toBe(false);
    expect(byId["pro-1"].locked).toBe(true);
    expect(byId["sel-1"].locked).toBe(false);
    expect(JSON.stringify(json)).not.toContain("allowedMerchantIds");
  });
});
