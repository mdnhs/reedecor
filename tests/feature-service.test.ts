import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mocks = vi.hoisted(() => ({ list: vi.fn(), set: vi.fn() }));

vi.mock("@/lib/supabase/features-db", () => ({ featuresDb: { list: mocks.list, set: mocks.set } }));

import { featureFlags, requireFeature } from "../src/server/feature-service";
import { Hono } from "hono";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-25T10:00:00Z"));
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  mocks.list.mockReset();
  mocks.set.mockReset();
  mocks.set.mockResolvedValue(undefined);
  featureFlags.clearCache();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("featureFlags", () => {
  it("turns off a feature that has a disabled row", async () => {
    mocks.list.mockResolvedValue([{ key: "wishlist", enabled: false }]);
    expect(await featureFlags.isEnabled("wishlist")).toBe(false);
    expect(await featureFlags.isEnabled("whatsapp_contact")).toBe(true);
  });

  it("keeps every feature enabled when the database cannot be read", async () => {
    mocks.list.mockRejectedValue(new Error("relation does not exist"));
    const flags = await featureFlags.getAll();
    expect(Object.values(flags).every(Boolean)).toBe(true);
  });

  it("reads the database once within the cache window", async () => {
    mocks.list.mockResolvedValue([]);
    await featureFlags.getAll();
    await featureFlags.getAll();
    expect(mocks.list).toHaveBeenCalledTimes(1);
  });

  it("reads again after the cache window", async () => {
    mocks.list.mockResolvedValue([]);
    await featureFlags.getAll();
    vi.advanceTimersByTime(5001);
    await featureFlags.getAll();
    expect(mocks.list).toHaveBeenCalledTimes(2);
  });

  it("clears the cache when a flag is set", async () => {
    mocks.list.mockResolvedValue([]);
    await featureFlags.getAll();
    await featureFlags.set("wishlist", false, "admin-1");
    mocks.list.mockResolvedValue([{ key: "wishlist", enabled: false }]);
    expect(await featureFlags.isEnabled("wishlist")).toBe(false);
    expect(mocks.set).toHaveBeenCalledWith("wishlist", false, "admin-1");
  });
});

describe("requireFeature", () => {
  const app = new Hono();
  app.post("/gated", requireFeature("wishlist"), async (c) => c.json({ ok: true }));

  it("lets the request through while the feature is on", async () => {
    mocks.list.mockResolvedValue([]);
    const res = await app.request("/gated", { method: "POST" });
    expect(res.status).toBe(200);
  });

  it("refuses the request with feature_disabled while the feature is off", async () => {
    mocks.list.mockResolvedValue([{ key: "wishlist", enabled: false }]);
    const res = await app.request("/gated", { method: "POST" });
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("feature_disabled");
  });
});
