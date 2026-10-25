import { describe, it, expect } from "vitest";
import { canUseAsset, normalizePlan, toMerchantView } from "../src/lib/assets/access";
import {
  MAX_ASSET_BYTES,
  assetMetaSchema,
  assetUpdateSchema,
  validateGlb,
} from "../src/lib/assets/validation";
import { assetObjectPath } from "../src/lib/assets/paths";
import type { AssetVersion, RoomAsset } from "../src/lib/assets/types";

const version: AssetVersion = {
  id: "ver-1",
  assetId: "asset-1",
  version: 1,
  glbUrl: "https://example.com/a.glb",
  storagePath: "assets/asset-1/v1.glb",
  previewUrl: null,
  widthCm: 40,
  depthCm: 40,
  heightCm: 120,
  fileSizeBytes: 1000,
  createdAt: "2026-10-25T00:00:00Z",
};

function makeAsset(overrides: Partial<RoomAsset> = {}): RoomAsset {
  return {
    id: "asset-1",
    name: "Fiddle plant",
    categoryId: "cat-1",
    accessLevel: "free",
    placement: "floor",
    hidden: false,
    allowedMerchantIds: [],
    currentVersion: version,
    createdAt: "2026-10-25T00:00:00Z",
    updatedAt: "2026-10-25T00:00:00Z",
    ...overrides,
  };
}

describe("canUseAsset", () => {
  it("lets every merchant use a free asset", () => {
    const asset = makeAsset({ accessLevel: "free" });
    expect(canUseAsset(asset, { id: "m1", plan: "free" })).toBe(true);
    expect(canUseAsset(asset, { id: "m1", plan: "pro" })).toBe(true);
    expect(canUseAsset(asset, { id: "m1", plan: null })).toBe(true);
    expect(canUseAsset(asset, { id: "m1" })).toBe(true);
  });

  it("limits a pro asset to merchants on the pro plan", () => {
    const asset = makeAsset({ accessLevel: "pro" });
    expect(canUseAsset(asset, { id: "m1", plan: "pro" })).toBe(true);
    expect(canUseAsset(asset, { id: "m1", plan: "free" })).toBe(false);
    expect(canUseAsset(asset, { id: "m1", plan: null })).toBe(false);
  });

  it("limits a selected asset to the allow-list regardless of plan", () => {
    const asset = makeAsset({ accessLevel: "selected", allowedMerchantIds: ["m-free"] });
    expect(canUseAsset(asset, { id: "m-free", plan: "free" })).toBe(true);
    expect(canUseAsset(asset, { id: "m-pro", plan: "pro" })).toBe(false);
  });
});

describe("toMerchantView", () => {
  it("returns null for a hidden asset", () => {
    expect(toMerchantView(makeAsset({ hidden: true }), { id: "m1", plan: "pro" })).toBeNull();
  });

  it("marks an asset the merchant cannot use as locked", () => {
    const view = toMerchantView(makeAsset({ accessLevel: "pro" }), { id: "m1", plan: "free" });
    expect(view?.locked).toBe(true);
  });

  it("marks an usable asset as unlocked", () => {
    const view = toMerchantView(makeAsset({ accessLevel: "pro" }), { id: "m1", plan: "pro" });
    expect(view?.locked).toBe(false);
  });

  it("never exposes the allow-list", () => {
    const view = toMerchantView(
      makeAsset({ accessLevel: "selected", allowedMerchantIds: ["m1", "m2"] }),
      { id: "m1", plan: "free" }
    );
    expect(view).not.toBeNull();
    expect("allowedMerchantIds" in (view as object)).toBe(false);
  });
});

function glbBuffer(overrides: { magic?: string; version?: number; length?: number } = {}) {
  const bytes = Buffer.alloc(20);
  bytes.write(overrides.magic ?? "glTF", 0, "ascii");
  bytes.writeUInt32LE(overrides.version ?? 2, 4);
  bytes.writeUInt32LE(overrides.length ?? bytes.length, 8);
  return bytes;
}

describe("validateGlb", () => {
  it("accepts a well-formed GLB header", () => {
    expect(validateGlb(glbBuffer())).toEqual({ ok: true });
  });

  it("rejects wrong magic bytes", () => {
    expect(validateGlb(glbBuffer({ magic: "PNG!" })).ok).toBe(false);
  });

  it("rejects an unsupported GLB version", () => {
    expect(validateGlb(glbBuffer({ version: 1 })).ok).toBe(false);
  });

  it("rejects a header length that differs from the buffer length", () => {
    expect(validateGlb(glbBuffer({ length: 9999 })).ok).toBe(false);
  });

  it("rejects a buffer shorter than the header", () => {
    expect(validateGlb(Buffer.from("glTF")).ok).toBe(false);
  });
});

describe("asset schemas", () => {
  const valid = {
    name: "Fiddle plant",
    categoryId: "cat-1",
    accessLevel: "free",
    placement: "floor",
    widthCm: 40,
    depthCm: 40,
    heightCm: 120,
  };

  it("caps asset size at 2 MB", () => {
    expect(MAX_ASSET_BYTES).toBe(2 * 1024 * 1024);
  });

  it("defaults the allow-list to empty", () => {
    const parsed = assetMetaSchema.parse(valid);
    expect(parsed.allowedMerchantIds).toEqual([]);
  });

  it("rejects a zero width", () => {
    expect(assetMetaSchema.safeParse({ ...valid, widthCm: 0 }).success).toBe(false);
  });

  it("rejects a width over 1000 cm", () => {
    expect(assetMetaSchema.safeParse({ ...valid, widthCm: 1001 }).success).toBe(false);
  });

  it("rejects an unknown access level", () => {
    expect(assetMetaSchema.safeParse({ ...valid, accessLevel: "enterprise" }).success).toBe(false);
  });

  it("rejects an empty name", () => {
    expect(assetMetaSchema.safeParse({ ...valid, name: "" }).success).toBe(false);
  });

  it("accepts a partial update with only hidden", () => {
    expect(assetUpdateSchema.safeParse({ hidden: true }).success).toBe(true);
  });

  it("rejects an update with an invalid access level", () => {
    expect(assetUpdateSchema.safeParse({ accessLevel: "nope" }).success).toBe(false);
  });
});

describe("normalizePlan", () => {
  it("keeps pro", () => {
    expect(normalizePlan("pro")).toBe("pro");
  });

  it.each([["free"], [null], [undefined], [""], ["enterprise"], [42]])(
    "treats %s as free",
    (value) => {
      expect(normalizePlan(value)).toBe("free");
    }
  );
});

describe("assetUpdateSchema defaults", () => {
  it("does not invent an allow-list when only hidden is sent", () => {
    expect(assetUpdateSchema.parse({ hidden: true })).toEqual({ hidden: true });
  });

  it("does not invent an allow-list when only the name is sent", () => {
    expect(assetUpdateSchema.parse({ name: "x" })).toEqual({ name: "x" });
  });

  it("keeps an explicit allow-list update", () => {
    expect(assetUpdateSchema.parse({ allowedMerchantIds: ["m1"] })).toEqual({
      allowedMerchantIds: ["m1"],
    });
  });
});

describe("assetObjectPath", () => {
  it("gives two uploads of the same version different paths", () => {
    const first = assetObjectPath("a1", 2, "glb", "token-1");
    const second = assetObjectPath("a1", 2, "glb", "token-2");
    expect(first).not.toBe(second);
  });

  it("keeps the asset id, version and kind in the path", () => {
    expect(assetObjectPath("a1", 2, "glb", "t")).toBe("assets/a1/v2-t.glb");
    expect(assetObjectPath("a1", 2, "preview", "t")).toBe("assets/a1/v2-t-preview.png");
  });
});
