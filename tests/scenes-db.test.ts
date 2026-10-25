import { describe, it, expect, vi, beforeEach } from "vitest";
import { EMPTY_SCENE } from "../src/lib/scenes/types";

const mocks = vi.hoisted(() => ({ result: { data: null as unknown, error: null as unknown } }));

vi.mock("../src/lib/supabase/db", () => ({
  getSupabaseClient: () => ({
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => mocks.result }) }),
    }),
  }),
}));

import { scenesDb } from "../src/lib/supabase/scenes-db";

beforeEach(() => {
  mocks.result = { data: null, error: null };
});

describe("scenesDb.get", () => {
  it("returns null when the product has no saved scene", async () => {
    expect(await scenesDb.get("p1")).toBeNull();
  });

  it("returns the stored scene", async () => {
    mocks.result = { data: { scene: EMPTY_SCENE }, error: null };
    expect(await scenesDb.get("p1")).toEqual(EMPTY_SCENE);
  });

  it("throws on a database error instead of pretending the scene is empty", async () => {
    mocks.result = { data: null, error: { message: "connection reset" } };
    await expect(scenesDb.get("p1")).rejects.toThrow("connection reset");
  });

  it("treats a stored scene that fails validation as no scene", async () => {
    mocks.result = { data: { scene: { schemaVersion: 9 } }, error: null };
    expect(await scenesDb.get("p1")).toBeNull();
  });
});
