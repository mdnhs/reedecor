import { describe, it, expect, vi, beforeEach } from "vitest";
import type { StoredProduct } from "../src/server/demo-store";

type Result = { data: unknown; error: { message: string } | null };

const mocks = vi.hoisted(() => ({
  results: {} as Record<string, Result>,
  inserts: [] as string[],
  insertedRows: [] as Array<{ table: string; data: unknown }>,
  updatedRows: [] as Array<{ table: string; data: unknown }>,
}));

function builder(table: string) {
  const result = () => mocks.results[table] ?? { data: [], error: null };
  const chain: Record<string, unknown> = {};
  for (const method of ["select", "order", "delete", "upsert"]) {
    chain[method] = () => chain;
  }
  chain.eq = () => chain;
  chain.update = (data: unknown) => {
    mocks.updatedRows.push({ table, data });
    return chain;
  };
  chain.insert = (data: unknown) => {
    mocks.inserts.push(table);
    mocks.insertedRows.push({ table, data });
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
const { storageService } = await import("../src/lib/storage/supabase-storage");

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
  mocks.insertedRows = [];
  mocks.updatedRows = [];
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

  it("intercepts base64 images and uploads them to storage bucket instead of inserting base64 into DB", async () => {
    vi.spyOn(storageService, "uploadBase64Image").mockResolvedValueOnce({
      path: "products/p2/front-123.jpg",
      publicUrl: "https://project.supabase.co/storage/v1/object/public/furniture-3d-studio/products/p2/front-123.jpg",
      sizeBytes: 100,
      mimeType: "image/jpeg",
    });

    const base64Data = "data:image/jpeg;base64,aGVsbG8=";
    const prodWithBase64: StoredProduct = {
      ...product,
      id: "p2",
      images: [
        {
          id: "img-1",
          viewType: "front",
          publicUrl: base64Data,
          storagePath: "temp",
          fileName: "front.jpg",
          mimeType: "image/jpeg",
          fileSizeBytes: 100,
        },
      ],
    };
    await supabaseDb.createProduct(prodWithBase64);

    const imageInsert = mocks.insertedRows.find((r) => r.table === "product_images");
    expect(imageInsert).toBeDefined();
    const insertedImages = imageInsert?.data as Array<{ public_url: string; storage_path: string }>;
    expect(insertedImages[0].public_url).toBe(
      "https://project.supabase.co/storage/v1/object/public/furniture-3d-studio/products/p2/front-123.jpg"
    );
    expect(insertedImages[0].public_url).not.toContain("data:");
  });

  it("intercepts base64 thumbnail and uploads to storage bucket instead of updating DB with base64", async () => {
    vi.spyOn(storageService, "uploadBase64Image").mockResolvedValueOnce({
      path: "products/p1/thumbnail-123.jpg",
      publicUrl: "https://project.supabase.co/storage/v1/object/public/furniture-3d-studio/products/p1/thumbnail-123.jpg",
      sizeBytes: 100,
      mimeType: "image/jpeg",
    });

    const base64Thumb = "data:image/jpeg;base64,dGh1bWI=";
    await supabaseDb.updateProductThumbnail("p1", base64Thumb);

    const productUpdate = mocks.updatedRows.find((r) => r.table === "products");
    expect(productUpdate).toBeDefined();
    const updatedData = productUpdate?.data as { thumbnail_url: string };
    expect(updatedData.thumbnail_url).toBe(
      "https://project.supabase.co/storage/v1/object/public/furniture-3d-studio/products/p1/thumbnail-123.jpg"
    );
    expect(updatedData.thumbnail_url).not.toContain("data:");
  });
});
