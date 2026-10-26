import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  calls: [] as Array<[string, string, string]>,
  rows: {} as Record<string, unknown>,
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: () => ({
      select: () => {
        const query = {
          eq: (column: string, value: string) => {
            mocks.calls.push(["eq", column, value]);
            return {
              maybeSingle: async () => ({ data: mocks.rows[`${column}:${value}`] ?? null, error: null }),
            };
          },
          or: (filter: string) => {
            mocks.calls.push(["or", filter, ""]);
            return { maybeSingle: async () => ({ data: null, error: null }) };
          },
        };
        return query;
      },
    }),
  }),
}));

vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-key");
vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");

const { supabaseDb } = await import("../src/lib/supabase/db");

beforeEach(() => {
  mocks.calls = [];
  mocks.rows = {};
});

describe("findMerchantUser", () => {
  it("never builds a PostgREST or-filter from the identifier", async () => {
    await supabaseDb.findMerchantUser("x,role.eq.saas_admin");
    expect(mocks.calls.some(([kind]) => kind === "or")).toBe(false);
  });

  it("matches by id first", async () => {
    mocks.rows["id:m-1"] = { id: "m-1" };
    expect(await supabaseDb.findMerchantUser("m-1")).toEqual({ id: "m-1" });
  });

  it("falls back to an exact email match", async () => {
    mocks.rows["email:shop@example.com"] = { id: "m-2" };
    expect(await supabaseDb.findMerchantUser("shop@example.com")).toEqual({ id: "m-2" });
    expect(mocks.calls).toContainEqual(["eq", "email", "shop@example.com"]);
  });

  it("returns null when nobody matches", async () => {
    expect(await supabaseDb.findMerchantUser("ghost")).toBeNull();
  });
});
