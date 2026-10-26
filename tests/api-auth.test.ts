import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { StoredProduct } from "../src/server/demo-store";

const users: Record<string, { id: string; role: string; plan: string }> = {
  "owner-token": { id: "m-owner", role: "merchant", plan: "free" },
  "other-token": { id: "m-other", role: "merchant", plan: "free" },
  "admin-token": { id: "admin-1", role: "saas_admin", plan: "free" },
  "customer-token": { id: "c-1", role: "customer", plan: "free" },
};

const mocks = vi.hoisted(() => ({
  authService: {
    validateSession: vi.fn(),
    createUser: vi.fn(),
    createSession: vi.fn(),
    verifyCredentials: vi.fn(),
    ensureSeedUsers: vi.fn(),
    deleteSession: vi.fn(),
  },
  supabaseDb: {
    getAllProducts: vi.fn(),
    getProductById: vi.fn(),
    createProduct: vi.fn(),
    deleteProduct: vi.fn(),
    getSystemSettings: vi.fn(),
    updateSystemSettings: vi.fn(),
    getMerchantPublicProfile: vi.fn(),
    updateMerchantProfile: vi.fn(),
  },
  storageService: { deleteProductAssets: vi.fn() },
}));

vi.mock("@/lib/supabase/auth-service", () => ({ authService: mocks.authService }));
vi.mock("@/lib/supabase/db", () => ({ supabaseDb: mocks.supabaseDb, getSupabaseClient: () => null }));
vi.mock("@/lib/storage/supabase-storage", () => ({ storageService: mocks.storageService }));
vi.mock("@/lib/meshy/client", () => ({ meshyClient: { updateConfig: vi.fn() } }));
vi.mock("@/lib/supabase/assets-db", () => ({ assetsDb: {} }));
vi.mock("@/lib/supabase/scenes-db", () => ({ scenesDb: {} }));
vi.mock("@/lib/supabase/features-db", () => ({ featuresDb: {} }));
vi.mock("@/server/feature-service", () => ({
  featureFlags: { isEnabled: async () => true, getAll: async () => ({}) },
  featureOffResponse: (c: { json: (b: unknown, s: number) => Response }) => c.json({ success: false }, 403),
  requireFeature: () => async (_c: unknown, next: () => Promise<void>) => next(),
}));
vi.mock("@/server/demo-store", () => ({
  inMemoryStore: {
    getAll: () => [],
    getById: () => undefined,
    add: vi.fn(),
    delete: vi.fn(),
    update: vi.fn(),
  },
}));

import { app } from "../src/server/app";

function product(id: string, merchantId: string, status: StoredProduct["status"] = "completed"): StoredProduct {
  return {
    id,
    merchantId,
    name: id,
    category: "Chair",
    widthMm: 1,
    depthMm: 1,
    heightMm: 1,
    priceBdt: 100,
    status,
    createdAt: "2026-10-26T00:00:00Z",
    updatedAt: "2026-10-26T00:00:00Z",
    images: [],
    generationAttempts: [],
  };
}

function req(path: string, token: string | null, init: RequestInit = {}) {
  return app.request(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers as Record<string, string> | undefined),
    },
  });
}

const products = [
  product("p-owner", "m-owner"),
  product("p-owner-draft", "m-owner", "draft"),
  product("p-other", "m-other"),
];

beforeEach(() => {
  vi.clearAllMocks();
  mocks.authService.validateSession.mockImplementation(async (token: string) => users[token] ?? null);
  mocks.supabaseDb.getAllProducts.mockResolvedValue(products);
  mocks.supabaseDb.getProductById.mockImplementation(async (id: string) => products.find((p) => p.id === id) ?? null);
  mocks.authService.createUser.mockImplementation(async (email: string, _pw: string, name: string, role: string) => ({
    id: "new-user",
    email,
    name,
    role,
  }));
  mocks.authService.createSession.mockResolvedValue("session-token");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("auth routes", () => {
  it("returns 401 from /auth/me when signed out", async () => {
    const res = await req("/api/auth/me", null);
    expect(res.status).toBe(401);
  });

  it("reports demo mode to a signed-in user", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const json = await (await req("/api/auth/me", "owner-token")).json();
    expect(json.data.demoMode).toBe(false);
  });

  it("allows public registration as a merchant", async () => {
    const res = await req("/api/auth/register", null, {
      method: "POST",
      body: JSON.stringify({ name: "Shop", email: "shop@example.com", password: "secret12", role: "merchant" }),
    });
    expect(res.status).toBe(201);
  });

  it("refuses public registration as saas_admin", async () => {
    const res = await req("/api/auth/register", null, {
      method: "POST",
      body: JSON.stringify({ name: "Shop", email: "shop@example.com", password: "secret12", role: "saas_admin" }),
    });
    expect(res.status).toBe(400);
    expect(mocks.authService.createUser).not.toHaveBeenCalled();
  });

  it("hides the demo role switcher in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const res = await req("/api/auth/switch-demo", null, {
      method: "POST",
      body: JSON.stringify({ role: "saas_admin" }),
    });
    expect(res.status).toBe(404);
    expect(mocks.authService.verifyCredentials).not.toHaveBeenCalled();
  });

  it("lets an admin create a user without replacing the admin session", async () => {
    const res = await req("/api/admin/users", "admin-token", {
      method: "POST",
      body: JSON.stringify({ name: "New", email: "new@example.com", password: "secret12", role: "saas_admin" }),
    });
    expect(res.status).toBe(201);
    expect(res.headers.get("set-cookie")).toBeNull();
    expect(mocks.authService.createSession).not.toHaveBeenCalled();
  });

  it("refuses admin user creation for merchants", async () => {
    const res = await req("/api/admin/users", "owner-token", {
      method: "POST",
      body: JSON.stringify({ name: "New", email: "new@example.com", password: "secret12", role: "merchant" }),
    });
    expect(res.status).toBe(403);
  });
});

describe("product access", () => {
  it("returns 401 for a signed-out delete", async () => {
    const res = await req("/api/products/p-owner", null, { method: "DELETE" });
    expect(res.status).toBe(401);
    expect(mocks.supabaseDb.deleteProduct).not.toHaveBeenCalled();
  });

  it("returns 403 when another merchant deletes the product", async () => {
    const res = await req("/api/products/p-owner", "other-token", { method: "DELETE" });
    expect(res.status).toBe(403);
    expect(mocks.supabaseDb.deleteProduct).not.toHaveBeenCalled();
  });

  it("lets the owner delete the product", async () => {
    const res = await req("/api/products/p-owner", "owner-token", { method: "DELETE" });
    expect(res.status).toBe(200);
    expect(mocks.supabaseDb.deleteProduct).toHaveBeenCalledWith("p-owner");
  });

  it("returns 403 when another merchant starts generation", async () => {
    const res = await req("/api/products/p-owner/generate", "other-token", { method: "POST" });
    expect(res.status).toBe(403);
  });

  it("returns 401 for signed-out product creation", async () => {
    const res = await req("/api/products", null, { method: "POST", body: JSON.stringify({}) });
    expect(res.status).toBe(401);
  });

  it("lists only the merchant's own products", async () => {
    const json = await (await req("/api/products", "owner-token")).json();
    expect(json.data.map((p: StoredProduct) => p.id)).toEqual(["p-owner", "p-owner-draft"]);
  });

  it("lists only completed products to customers", async () => {
    const json = await (await req("/api/products", "customer-token")).json();
    expect(json.data.map((p: StoredProduct) => p.id)).toEqual(["p-owner", "p-other"]);
  });

  it("returns 401 for a signed-out product list", async () => {
    const res = await req("/api/products", null);
    expect(res.status).toBe(401);
  });

  it("returns 401 for a signed-out profile update", async () => {
    const res = await req("/api/merchants/profile", null, {
      method: "PATCH",
      body: JSON.stringify({ businessName: "Defaced" }),
    });
    expect(res.status).toBe(401);
    expect(mocks.supabaseDb.updateMerchantProfile).not.toHaveBeenCalled();
  });
});

describe("model proxy", () => {
  it("refuses hosts outside the allowlist without fetching", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const res = await req(`/api/proxy-model?url=${encodeURIComponent("http://169.254.169.254/latest")}`, null);
    expect(res.status).toBe(400);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("passes through an expired Meshy URL instead of serving a stand-in model", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("gone", { status: 403 }));
    const res = await req(`/api/proxy-model?url=${encodeURIComponent("https://assets.meshy.ai/t/m.glb")}`, null);
    expect(res.status).toBe(403);
    expect(res.headers.get("X-Fallback-Model")).toBeNull();
    fetchSpy.mockRestore();
  });

  it("refuses responses larger than the size cap", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("x", { status: 200, headers: { "content-length": String(200 * 1024 * 1024) } })
    );
    const res = await req(`/api/proxy-model?url=${encodeURIComponent("https://assets.meshy.ai/t/m.glb")}`, null);
    expect(res.status).toBe(413);
    fetchSpy.mockRestore();
  });
});

describe("admin settings secrets", () => {
  beforeEach(() => {
    mocks.supabaseDb.getSystemSettings.mockResolvedValue({
      meshyApiKey: "msy_secretkey9876",
      meshyApiBaseUrl: "https://api.meshy.ai",
    });
    mocks.supabaseDb.updateSystemSettings.mockResolvedValue({ success: true, data: {} });
  });

  it("never returns the Meshy key in plain text", async () => {
    const json = await (await req("/api/admin/settings", "admin-token")).json();
    expect(json.data.meshyApiKey).toBe("••••9876");
  });

  it("rejects a Meshy base URL outside meshy.ai", async () => {
    const res = await req("/api/admin/settings", "admin-token", {
      method: "PATCH",
      body: JSON.stringify({ meshyApiBaseUrl: "https://evil.com" }),
    });
    expect(res.status).toBe(400);
    expect(mocks.supabaseDb.updateSystemSettings).not.toHaveBeenCalled();
  });

  it("keeps the stored key when the masked value is sent back", async () => {
    await req("/api/admin/settings", "admin-token", {
      method: "PATCH",
      body: JSON.stringify({ meshyApiKey: "••••9876", meshyModel: "meshy-7.1" }),
    });
    expect(mocks.supabaseDb.updateSystemSettings).toHaveBeenCalledWith({ meshyModel: "meshy-7.1" });
  });
});

describe("login throttling", () => {
  it("returns 429 after repeated failed logins for the same email", async () => {
    mocks.authService.verifyCredentials.mockResolvedValue(null);
    const attempt = () =>
      req("/api/auth/login", null, {
        method: "POST",
        headers: { "x-forwarded-for": "10.0.0.9" },
        body: JSON.stringify({ email: "victim@example.com", password: "guess123" }),
      });
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) statuses.push((await attempt()).status);
    expect(statuses.slice(0, 5).every((s) => s === 401)).toBe(true);
    expect(statuses[5]).toBe(429);
  });
});

describe("login throttling hardening", () => {
  it("cannot be bypassed by rotating x-forwarded-for", async () => {
    mocks.authService.verifyCredentials.mockResolvedValue(null);
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) {
      const res = await req("/api/auth/login", null, {
        method: "POST",
        headers: { "x-forwarded-for": `10.1.0.${i}` },
        body: JSON.stringify({ email: "rotate@example.com", password: "guess123" }),
      });
      statuses.push(res.status);
    }
    expect(statuses[5]).toBe(429);
  });

  it("does not lock out a user who signs in successfully several times", async () => {
    mocks.authService.verifyCredentials.mockResolvedValue({ id: "m-owner", role: "merchant" });
    const statuses: number[] = [];
    for (let i = 0; i < 7; i++) {
      const res = await req("/api/auth/login", null, {
        method: "POST",
        body: JSON.stringify({ email: "happy@example.com", password: "secret12" }),
      });
      statuses.push(res.status);
    }
    expect(statuses.every((s) => s === 200)).toBe(true);
  });
});

describe("model proxy hardening", () => {
  it("does not follow redirects away from the allowlisted host", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("ok", { status: 200 }));
    await req(`/api/proxy-model?url=${encodeURIComponent("https://assets.meshy.ai/t/m.glb")}`, null);
    expect(fetchSpy.mock.calls[0][1]).toMatchObject({ redirect: "error" });
    fetchSpy.mockRestore();
  });

  it("stops reading a body without content-length once it passes the cap", async () => {
    const chunk = new Uint8Array(8 * 1024 * 1024);
    let sent = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        sent += chunk.byteLength;
        controller.enqueue(chunk);
        if (sent > 80 * 1024 * 1024) controller.close();
      },
    });
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(stream, { status: 200 }));
    const res = await req(`/api/proxy-model?url=${encodeURIComponent("https://assets.meshy.ai/t/m.glb")}`, null);
    expect(res.status).toBe(413);
    expect(sent).toBeLessThanOrEqual(72 * 1024 * 1024);
    fetchSpy.mockRestore();
  });
});
