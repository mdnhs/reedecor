import { describe, it, expect, vi, beforeEach } from "vitest";

const users: Record<string, { id: string; role: string }> = {
  "admin-token": { id: "admin-1", role: "saas_admin" },
  "merchant-token": { id: "m-1", role: "merchant" },
  "customer-token": { id: "c-1", role: "customer" },
};

const mocks = vi.hoisted(() => ({
  validateSession: vi.fn(),
  getAll: vi.fn(),
  set: vi.fn(),
  list: vi.fn(),
}));

vi.mock("@/lib/supabase/auth-service", () => ({ authService: { validateSession: mocks.validateSession } }));
vi.mock("@/server/feature-service", () => ({ featureFlags: { getAll: mocks.getAll, set: mocks.set } }));
vi.mock("@/lib/supabase/features-db", () => ({ featuresDb: { list: mocks.list } }));

import { featureRoutes } from "../src/server/feature-routes";
import { FEATURE_KEYS } from "../src/lib/features/catalog";
import { Hono } from "hono";

const app = new Hono().basePath("/api");
app.route(
  "/",
  featureRoutes(async (c) => {
    const header = c.req.header("Authorization");
    const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
    return token ? (mocks.validateSession(token) as never) : null;
  })
);

const allOn = Object.fromEntries(FEATURE_KEYS.map((key) => [key, true]));

function put(token: string | null, key: string, body: unknown) {
  return app.request(`/api/admin/features/${key}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
}

function as(token: string) {
  return { headers: { Authorization: `Bearer ${token}` } };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.validateSession.mockImplementation(async (token: string) => users[token] ?? null);
  mocks.getAll.mockResolvedValue(allOn);
  mocks.set.mockResolvedValue(undefined);
  mocks.list.mockResolvedValue([]);
});

describe("GET /features", () => {
  it("is public and returns the flag map", async () => {
    mocks.getAll.mockResolvedValue({ ...allOn, wishlist: false });
    const res = await app.request("/api/features");
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.data.wishlist).toBe(false);
    expect(json.data.whatsapp_contact).toBe(true);
  });
});

describe("GET /admin/features", () => {
  it("rejects anonymous and non-admin callers", async () => {
    expect((await app.request("/api/admin/features")).status).toBe(401);
    expect((await app.request("/api/admin/features", as("merchant-token"))).status).toBe(403);
    expect((await app.request("/api/admin/features", as("customer-token"))).status).toBe(403);
  });

  it("lists the catalogue in order with stored state", async () => {
    mocks.list.mockResolvedValue([
      { key: "wishlist", enabled: false, updatedBy: "admin-1", updatedAt: "2026-10-25T10:00:00Z" },
    ]);
    const json = await (await app.request("/api/admin/features", as("admin-token"))).json();
    expect(json.data.map((f: { key: string }) => f.key)).toEqual([...FEATURE_KEYS]);
    const wishlist = json.data.find((f: { key: string }) => f.key === "wishlist");
    expect(wishlist).toMatchObject({ enabled: false, updatedBy: "admin-1", updatedAt: "2026-10-25T10:00:00Z" });
    expect(json.data.find((f: { key: string }) => f.key === "scene_editor").enabled).toBe(true);
  });

  it("returns 500 with a message when the table cannot be read", async () => {
    mocks.list.mockRejectedValue(new Error("relation does not exist"));
    const res = await app.request("/api/admin/features", as("admin-token"));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toContain("relation does not exist");
  });
});

describe("PUT /admin/features/:key", () => {
  it("rejects anonymous callers with 401", async () => {
    expect((await put(null, "wishlist", { enabled: false })).status).toBe(401);
  });

  it("rejects merchants and customers with 403", async () => {
    expect((await put("merchant-token", "wishlist", { enabled: false })).status).toBe(403);
    expect((await put("customer-token", "wishlist", { enabled: false })).status).toBe(403);
    expect(mocks.set).not.toHaveBeenCalled();
  });

  it("rejects an unknown key with 400", async () => {
    expect((await put("admin-token", "mystery", { enabled: false })).status).toBe(400);
    expect(mocks.set).not.toHaveBeenCalled();
  });

  it("rejects a non-boolean enabled with 400", async () => {
    expect((await put("admin-token", "wishlist", { enabled: "yes" })).status).toBe(400);
    expect((await put("admin-token", "wishlist", {})).status).toBe(400);
  });

  it("saves the flag as the admin and returns the entry", async () => {
    const res = await put("admin-token", "wishlist", { enabled: false });
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(mocks.set).toHaveBeenCalledWith("wishlist", false, "admin-1");
    expect(json.data).toMatchObject({ key: "wishlist", enabled: false, updatedBy: "admin-1" });
  });

  it("returns 500 with a message when saving fails", async () => {
    mocks.set.mockRejectedValue(new Error("write failed"));
    const res = await put("admin-token", "wishlist", { enabled: false });
    expect(res.status).toBe(500);
    expect((await res.json()).error).toContain("write failed");
  });
});
