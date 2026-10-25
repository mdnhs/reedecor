import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AssetVersion, RoomAsset } from "../src/lib/assets/types";
import type { SceneData, SceneItem } from "../src/lib/scenes/types";

const users: Record<string, { id: string; role: string; plan: string }> = {
  "owner-token": { id: "m-owner", role: "merchant", plan: "free" },
  "other-token": { id: "m-other", role: "merchant", plan: "free" },
  "admin-token": { id: "admin-1", role: "saas_admin", plan: "free" },
  "customer-token": { id: "c-1", role: "customer", plan: "free" },
};

const mocks = vi.hoisted(() => ({
  validateSession: vi.fn(),
  scenesDb: { get: vi.fn(), upsert: vi.fn() },
  assetsDb: { getVersionsWithAssets: vi.fn() },
  getProductById: vi.fn(),
  inMemoryGetById: vi.fn(),
}));

vi.mock("@/lib/supabase/auth-service", () => ({
  authService: { validateSession: mocks.validateSession },
}));
vi.mock("@/lib/supabase/scenes-db", () => ({ scenesDb: mocks.scenesDb }));
vi.mock("@/lib/supabase/assets-db", () => ({ assetsDb: mocks.assetsDb }));
vi.mock("@/lib/supabase/db", () => ({ supabaseDb: { getProductById: mocks.getProductById } }));
vi.mock("@/server/demo-store", () => ({ inMemoryStore: { getById: mocks.inMemoryGetById } }));

import { sceneRoutes } from "../src/server/scene-routes";
import { Hono } from "hono";

const app = new Hono().basePath("/api");
app.route(
  "/",
  sceneRoutes(async (c) => {
    const header = c.req.header("Authorization");
    const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
    return token ? (mocks.validateSession(token) as never) : null;
  })
);

function version(id: string, assetId: string): AssetVersion {
  return {
    id,
    assetId,
    version: 1,
    glbUrl: `https://x/${id}.glb`,
    storagePath: "p",
    previewUrl: null,
    widthCm: 40,
    depthCm: 30,
    heightCm: 120,
    fileSizeBytes: 1,
    createdAt: "2026-10-25T00:00:00Z",
  };
}

function asset(id: string, overrides: Partial<RoomAsset> = {}): RoomAsset {
  return {
    id,
    name: id,
    categoryId: "c",
    accessLevel: "free",
    placement: "floor",
    hidden: false,
    allowedMerchantIds: [],
    currentVersion: version(`ver-${id}`, id),
    createdAt: "2026-10-25T00:00:00Z",
    updatedAt: "2026-10-25T00:00:00Z",
    ...overrides,
  };
}

function versionsFor(...assets: RoomAsset[]) {
  return new Map(assets.map((a) => [a.currentVersion.id, { version: a.currentVersion, asset: a }]));
}

function item(id: string, assetId = "plant", overrides: Partial<SceneItem> = {}): SceneItem {
  return { id, assetId, versionId: `ver-${assetId}`, x: 10, z: 20, rotationY: 0, scale: 1, ...overrides };
}

function scene(items: SceneItem[], backdrop: SceneData["backdrop"] = "auto"): SceneData {
  return { schemaVersion: 1, backdrop, items };
}

function put(token: string | null, body: unknown, id = "prod-1") {
  return app.request(`/api/products/${id}/scene`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

const plant = asset("plant");
const proLamp = asset("lamp", { accessLevel: "pro" });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.validateSession.mockImplementation(async (token: string) => users[token] ?? null);
  mocks.getProductById.mockResolvedValue({ id: "prod-1", merchantId: "m-owner" });
  mocks.inMemoryGetById.mockReturnValue(null);
  mocks.scenesDb.get.mockResolvedValue(null);
  mocks.scenesDb.upsert.mockResolvedValue(undefined);
  mocks.assetsDb.getVersionsWithAssets.mockImplementation(async (ids: string[]) => {
    const all = versionsFor(plant, proLamp);
    return new Map([...all].filter(([id]) => ids.includes(id)));
  });
});

describe("GET /products/:id/scene", () => {
  it("returns 404 for an unknown product", async () => {
    mocks.getProductById.mockResolvedValue(null);
    const res = await app.request("/api/products/missing/scene");
    expect(res.status).toBe(404);
  });

  it("returns the empty scene when none is saved", async () => {
    const res = await app.request("/api/products/prod-1/scene");
    const json = await res.json();
    expect(json.data).toEqual({ schemaVersion: 1, backdrop: "auto", items: [] });
  });

  it("resolves present versions and drops items whose version is missing", async () => {
    mocks.scenesDb.get.mockResolvedValue(
      scene([item("a"), item("b", "ghost", { versionId: "ver-ghost" })], "studio")
    );
    const res = await app.request("/api/products/prod-1/scene");
    const json = await res.json();
    expect(json.data.backdrop).toBe("studio");
    expect(json.data.items).toHaveLength(1);
    expect(json.data.items[0]).toMatchObject({
      id: "a",
      glbUrl: "https://x/ver-plant.glb",
      widthCm: 40,
      depthCm: 30,
      heightCm: 120,
      placement: "floor",
    });
  });

  it("returns a 500 envelope when the scene cannot be read", async () => {
    mocks.scenesDb.get.mockRejectedValue(new Error("db down"));
    const res = await app.request("/api/products/prod-1/scene");
    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ success: false });
  });

  it("does not save when the previous scene cannot be read", async () => {
    mocks.scenesDb.get.mockRejectedValue(new Error("db down"));
    const res = await put("owner-token", scene([item("a")]));
    expect(res.status).toBe(500);
    expect(mocks.scenesDb.upsert).not.toHaveBeenCalled();
  });

  it("is public", async () => {
    expect((await app.request("/api/products/prod-1/scene")).status).toBe(200);
  });
});

describe("PUT /products/:id/scene", () => {
  it("rejects anonymous callers with 401", async () => {
    expect((await put(null, scene([]))).status).toBe(401);
  });

  it("rejects customers with 403", async () => {
    expect((await put("customer-token", scene([]))).status).toBe(403);
  });

  it("rejects a merchant who does not own the product with 403", async () => {
    expect((await put("other-token", scene([]))).status).toBe(403);
  });

  it("returns 404 for an unknown product", async () => {
    mocks.getProductById.mockResolvedValue(null);
    expect((await put("owner-token", scene([]), "missing")).status).toBe(404);
  });

  it("lets a saas admin save on any product", async () => {
    const res = await put("admin-token", scene([item("a")]));
    expect(res.status).toBe(200);
    expect(mocks.scenesDb.upsert).toHaveBeenCalled();
  });

  it("rejects 21 items with 400 and stores nothing", async () => {
    const items = Array.from({ length: 21 }, (_, i) => item(`i-${i}`));
    const res = await put("owner-token", scene(items));
    expect(res.status).toBe(400);
    expect(mocks.scenesDb.upsert).not.toHaveBeenCalled();
  });

  it.each([
    ["scale zero", { scale: 0 }],
    ["x far away", { x: 100000 }],
  ])("rejects %s with 400", async (_name, overrides) => {
    const res = await put("owner-token", scene([item("a", "plant", overrides)]));
    expect(res.status).toBe(400);
    expect(mocks.scenesDb.upsert).not.toHaveBeenCalled();
  });

  it("rejects an unknown version id with 400", async () => {
    const res = await put("owner-token", scene([item("a", "plant", { versionId: "nope" })]));
    expect(res.status).toBe(400);
  });

  it("rejects a new item that uses a locked asset with 403", async () => {
    const res = await put("owner-token", scene([item("a", "lamp")]));
    expect(res.status).toBe(403);
    expect(mocks.scenesDb.upsert).not.toHaveBeenCalled();
  });

  it("keeps an already-saved locked item when the scene is saved again", async () => {
    mocks.scenesDb.get.mockResolvedValue(scene([item("a", "lamp")]));
    const res = await put("owner-token", scene([item("a", "lamp", { x: 50 })]));
    expect(res.status).toBe(200);
  });

  it("rejects a second copy of a locked asset", async () => {
    mocks.scenesDb.get.mockResolvedValue(scene([item("a", "lamp")]));
    const res = await put("owner-token", scene([item("a", "lamp"), item("b", "lamp")]));
    expect(res.status).toBe(403);
  });

  it("saves an empty items list and returns it resolved", async () => {
    mocks.scenesDb.get.mockResolvedValue(scene([item("a", "lamp")]));
    const res = await put("owner-token", scene([], "white"));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(mocks.scenesDb.upsert).toHaveBeenCalledWith("prod-1", scene([], "white"), "m-owner");
    expect(json.data.items).toEqual([]);
  });

  it("returns 500 with a message when the database fails", async () => {
    mocks.scenesDb.upsert.mockRejectedValue(new Error("db down"));
    const res = await put("owner-token", scene([item("a")]));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toContain("db down");
  });
});

describe("room in the scene API", () => {
  const room = { enabled: true, wallColor: "#e7e0d5", floorType: "walnut" } as const;

  it("saves a valid room and returns it", async () => {
    const res = await put("owner-token", { ...scene([item("a")]), room });
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(mocks.scenesDb.upsert).toHaveBeenCalledWith("prod-1", { ...scene([item("a")]), room }, "m-owner");
    expect(json.data.room).toEqual(room);
  });

  it("returns the stored room on read", async () => {
    mocks.scenesDb.get.mockResolvedValue({ ...scene([item("a")]), room });
    const json = await (await app.request("/api/products/prod-1/scene")).json();
    expect(json.data.room).toEqual(room);
  });

  it("omits the room for a scene saved without one", async () => {
    mocks.scenesDb.get.mockResolvedValue(scene([item("a")]));
    const json = await (await app.request("/api/products/prod-1/scene")).json();
    expect("room" in json.data).toBe(false);
  });

  it("rejects a wall colour that is not a hex value", async () => {
    const res = await put("owner-token", { ...scene([]), room: { ...room, wallColor: "red" } });
    expect(res.status).toBe(400);
    expect(mocks.scenesDb.upsert).not.toHaveBeenCalled();
  });

  it("rejects an unknown floor type", async () => {
    const res = await put("owner-token", { ...scene([]), room: { ...room, floorType: "lava" } });
    expect(res.status).toBe(400);
  });

  it("accepts a room-only change on an unchanged scene", async () => {
    mocks.scenesDb.get.mockResolvedValue(scene([item("a")]));
    const res = await put("owner-token", { ...scene([item("a")]), room });
    expect(res.status).toBe(200);
  });
});
