import { describe, it, expect } from "vitest";
import { toPublicStore } from "../src/lib/public-store";
import type { StoredProduct } from "../src/server/demo-store";
import type { MerchantUserRow } from "../src/lib/supabase/db";

const merchant: MerchantUserRow = {
  id: "m-1",
  name: "Rahim",
  email: "rahim@example.com",
  role: "merchant",
  business_name: "Rahim Furniture",
  bio: null,
  whatsapp_number: null,
  location: null,
};

function product(id: string, merchantId: string, status: StoredProduct["status"], priceBdt = 1000): StoredProduct {
  return {
    id,
    merchantId,
    name: id,
    category: "Chair",
    description: null,
    widthMm: 1,
    depthMm: 2,
    heightMm: 3,
    priceBdt,
    status,
    thumbnailUrl: "https://cdn/t.png",
    createdAt: "2026-10-26T00:00:00Z",
    updatedAt: "2026-10-26T00:00:00Z",
    images: [
      {
        id: "i",
        viewType: "front",
        publicUrl: "https://cdn/f.jpg",
        storagePath: "products/x/front.jpg",
        fileName: "f.jpg",
        mimeType: "image/jpeg",
        fileSizeBytes: 1,
      },
    ],
    generationAttempts: [
      {
        id: "g",
        provider: "meshy",
        providerTaskId: "secret-task",
        status: "completed",
        modelUrl: "https://cdn/m.glb",
        creditCostEstimate: 20,
        createdAt: "2026-10-26T00:00:00Z",
      } as StoredProduct["generationAttempts"][number],
    ],
  };
}

const catalog = [
  product("mine-done", "m-1", "completed"),
  product("mine-draft", "m-1", "draft"),
  product("theirs-done", "m-2", "completed"),
];

describe("toPublicStore", () => {
  it("lists only the merchant's own completed products", () => {
    const store = toPublicStore(merchant, catalog, 0);
    expect(store.products.map((p) => p.id)).toEqual(["mine-done"]);
  });

  it("returns an empty catalog instead of other merchants' products", () => {
    const store = toPublicStore({ ...merchant, id: "m-empty" }, catalog, 0);
    expect(store.products).toEqual([]);
  });

  it("never exposes email, generation attempts or storage paths", () => {
    const store = toPublicStore(merchant, catalog, 0);
    const json = JSON.stringify(store);
    expect(json).not.toContain("rahim@example.com");
    expect(json).not.toContain("secret-task");
    expect(json).not.toContain("storagePath");
    expect(json).not.toContain("generationAttempts");
  });

  it("reports the real follower count and missing contact details as null", () => {
    const store = toPublicStore(merchant, catalog, 3);
    expect(store.followerCount).toBe(3);
    expect(store.whatsappNumber).toBeNull();
    expect(store.location).toBeNull();
  });

  it("marks products as AI-generated with their model url", () => {
    const [p] = toPublicStore(merchant, catalog, 0).products;
    expect(p.aiGenerated).toBe(true);
    expect(p.modelUrl).toBe("https://cdn/m.glb");
    expect(p.thumbnailUrl).toBe("https://cdn/t.png");
  });

  it("keeps a missing price as null instead of inventing one", () => {
    const store = toPublicStore(merchant, [product("free", "m-1", "completed", 0)], 0);
    expect(store.products[0].priceBdt).toBeNull();
  });
});
