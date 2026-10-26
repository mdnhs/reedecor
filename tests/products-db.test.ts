import { describe, it, expect, vi, beforeEach } from "vitest";
import type { StoredProduct } from "../src/server/demo-store";

type Result = { data: unknown; error: { message: string } | null };

const mocks = vi.hoisted(() => ({
  results: {} as Record<string, Result>,
  inserts: [] as string[],
}));

function builder(table: string) {
  const result = () => mocks.results[table] ?? { data: [], error: null };
  const chain: Record<string, unknown> = {};
  for (const method of ["select", "order", "eq", "update", "delete", "upsert"]) {
    chain[method] = () => chain;
  }
  chain.insert = () => {
    mocks.inserts.push(table);
    return chain;
  };
  chain.then = (resolve: (r: Result) => unknown, reject: (e: unknown) => unknown) =>
    Promise.resolve(result()).then(resolve, reject);
  return chain;
}

vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({ from: (t: string) => builder(t) }) }));
vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-key");
vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");

const { supabaseDb } = await import("../src/lib/supabase/db");

const product: StoredProduct = {
  id: "p1",
  merchantId: "m1",
  name: "Chair",
  category: "Chair",
  widthMm: 1,
  depthMm: 1,
  heightMm: 1,
  priceBdt: 0,
  status: "draft",
  createdAt: "2026-10-26T00:00:00Z",
  updatedAt: "2026-10-26T00:00:00Z",
  images: [],
  generationAttempts: [],
};

beforeEach(() => {
  mocks.results = {};
  mocks.inserts = [];
});

describe("product data layer", () => {
  it("returns an empty catalog without writing demo products", async () => {
    expect(await supabaseDb.getAllProducts()).toEqual([]);
    expect(mocks.inserts).toEqual([]);
  });

  it("throws when the product query fails", async () => {
    mocks.results.products = { data: null, error: { message: "db down" } };
    await expect(supabaseDb.getAllProducts()).rejects.toThrow("db down");
  });

  it("keeps a missing price as zero instead of inventing one", async () => {
    mocks.results.products = {
      data: [{ id: "p1", merchant_id: "m1", name: "c", category: "c", price_bdt: null, status: "draft" }],
      error: null,
    };
    const [p] = await supabaseDb.getAllProducts();
    expect(p.priceBdt).toBe(0);
  });

  it("throws when creating a product fails", async () => {
    mocks.results.products = { data: null, error: { message: "insert failed" } };
    await expect(supabaseDb.createProduct(product)).rejects.toThrow("insert failed");
  });

  it("throws when deleting a product fails", async () => {
    mocks.results.products = { data: null, error: { message: "delete failed" } };
    await expect(supabaseDb.deleteProduct("p1")).rejects.toThrow("delete failed");
  });

  it("throws when a status update fails", async () => {
    mocks.results.products = { data: null, error: { message: "update failed" } };
    await expect(supabaseDb.updateProductStatus("p1", "failed")).rejects.toThrow("update failed");
  });

  it("throws when recording a generation attempt fails", async () => {
    mocks.results.generation_attempts = { data: null, error: { message: "attempt failed" } };
    await expect(
      supabaseDb.addGenerationAttempt("p1", {
        id: "g1",
        provider: "meshy",
        providerTaskId: "t",
        status: "processing",
        modelUrl: null,
        creditCostEstimate: 20,
        errorCode: null,
        errorMessage: null,
        createdAt: "2026-10-26T00:00:00Z",
        completedAt: null,
      })
    ).rejects.toThrow("attempt failed");
  });
});
