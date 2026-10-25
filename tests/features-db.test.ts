import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  list: { data: null as unknown, error: null as unknown },
  upsert: { error: null as unknown },
  lastUpsert: null as unknown,
}));

vi.mock("../src/lib/supabase/db", () => ({
  getSupabaseClient: () => ({
    from: () => ({
      select: async () => mocks.list,
      upsert: async (row: unknown) => {
        mocks.lastUpsert = row;
        return mocks.upsert;
      },
    }),
  }),
}));

import { featuresDb } from "../src/lib/supabase/features-db";

beforeEach(() => {
  mocks.list = { data: [], error: null };
  mocks.upsert = { error: null };
  mocks.lastUpsert = null;
});

describe("featuresDb", () => {
  it("maps stored rows", async () => {
    mocks.list = {
      data: [{ key: "wishlist", enabled: false, updated_by: "admin-1", updated_at: "2026-10-25T10:00:00Z" }],
      error: null,
    };
    expect(await featuresDb.list()).toEqual([
      { key: "wishlist", enabled: false, updatedBy: "admin-1", updatedAt: "2026-10-25T10:00:00Z" },
    ]);
  });

  it("throws when the table cannot be read", async () => {
    mocks.list = { data: null, error: { message: "relation does not exist" } };
    await expect(featuresDb.list()).rejects.toThrow("relation does not exist");
  });

  it("upserts a flag with who changed it", async () => {
    await featuresDb.set("wishlist", false, "admin-1");
    expect(mocks.lastUpsert).toMatchObject({ key: "wishlist", enabled: false, updated_by: "admin-1" });
  });

  it("throws when saving fails", async () => {
    mocks.upsert = { error: { message: "write failed" } };
    await expect(featuresDb.set("wishlist", true, "admin-1")).rejects.toThrow("write failed");
  });
});
