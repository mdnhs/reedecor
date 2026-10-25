import { describe, it, expect } from "vitest";
import { EMPTY_SCENE, MAX_SCENE_ITEMS, type SceneItem } from "../src/lib/scenes/types";
import { sceneSchema } from "../src/lib/scenes/schema";
import { assetBaseScale, worldUnitsPerCm } from "../src/lib/scenes/scale";
import { validateSceneSave } from "../src/lib/scenes/rules";
import { isUuid } from "../src/lib/assets/ids";
import { DirtyTracker } from "../src/lib/scenes/dirty-tracker";
import type { AssetVersion, RoomAsset } from "../src/lib/assets/types";

function item(index: number, overrides: Partial<SceneItem> = {}): SceneItem {
  return {
    id: `item-${index}`,
    assetId: "asset-1",
    versionId: "ver-1",
    x: 10,
    z: -20,
    rotationY: 0.5,
    scale: 1,
    ...overrides,
  };
}

function sceneWith(items: SceneItem[]) {
  return { ...EMPTY_SCENE, items };
}

describe("sceneSchema", () => {
  it("accepts the empty scene", () => {
    expect(sceneSchema.safeParse(EMPTY_SCENE).success).toBe(true);
  });

  it("accepts exactly the maximum number of items", () => {
    const items = Array.from({ length: MAX_SCENE_ITEMS }, (_, i) => item(i));
    expect(sceneSchema.safeParse(sceneWith(items)).success).toBe(true);
  });

  it("rejects one item over the maximum", () => {
    const items = Array.from({ length: MAX_SCENE_ITEMS + 1 }, (_, i) => item(i));
    expect(sceneSchema.safeParse(sceneWith(items)).success).toBe(false);
  });

  it("rejects duplicate item ids", () => {
    expect(sceneSchema.safeParse(sceneWith([item(1), item(1)])).success).toBe(false);
  });

  it.each([
    ["scale zero", { scale: 0 }],
    ["scale above the maximum", { scale: 5.01 }],
    ["scale below the minimum", { scale: 0.19 }],
    ["x above the limit", { x: 501 }],
    ["z below the limit", { z: -501 }],
    ["x NaN", { x: NaN }],
    ["rotation Infinity", { rotationY: Infinity }],
  ])("rejects %s", (_name, overrides) => {
    expect(sceneSchema.safeParse(sceneWith([item(1, overrides)])).success).toBe(false);
  });

  it("accepts the limits themselves", () => {
    const edge = item(1, { scale: 5, x: 500, z: -500 });
    expect(sceneSchema.safeParse(sceneWith([edge])).success).toBe(true);
  });

  it("rejects an unknown backdrop", () => {
    expect(sceneSchema.safeParse({ ...EMPTY_SCENE, backdrop: "neon" }).success).toBe(false);
  });

  it("rejects another schema version", () => {
    expect(sceneSchema.safeParse({ ...EMPTY_SCENE, schemaVersion: 2 }).success).toBe(false);
  });
});

describe("worldUnitsPerCm", () => {
  it("uses the largest product side", () => {
    expect(worldUnitsPerCm({ widthMm: 850, depthMm: 750, heightMm: 820 })).toBeCloseTo(1.05 / 85);
    expect(worldUnitsPerCm({ widthMm: 500, depthMm: 500, heightMm: 2000 })).toBeCloseTo(1.05 / 200);
  });

  it("falls back to the default chair for missing or zero dimensions", () => {
    expect(worldUnitsPerCm({ widthMm: 850, depthMm: 750, heightMm: 0 })).toBeCloseTo(1.05 / 85);
    expect(worldUnitsPerCm({ widthMm: null, depthMm: null, heightMm: null })).toBeCloseTo(1.05 / 85);
    expect(worldUnitsPerCm({})).toBeCloseTo(1.05 / 85);
  });
});

describe("assetBaseScale", () => {
  it("makes the model's largest side equal the asset's real size", () => {
    expect(assetBaseScale({ worldPerCm: 0.01, assetMaxCm: 120, modelMaxSize: 2 })).toBeCloseTo(0.6);
  });

  it("returns 1 when the model has no size", () => {
    expect(assetBaseScale({ worldPerCm: 0.01, assetMaxCm: 120, modelMaxSize: 0 })).toBe(1);
  });
});

function makeVersion(id: string, assetId: string): AssetVersion {
  return {
    id,
    assetId,
    version: 1,
    glbUrl: "https://x/a.glb",
    storagePath: "p",
    previewUrl: null,
    widthCm: 40,
    depthCm: 40,
    heightCm: 100,
    fileSizeBytes: 1,
    createdAt: "2026-10-25T00:00:00Z",
  };
}

function makeAsset(id: string, overrides: Partial<RoomAsset> = {}): RoomAsset {
  return {
    id,
    name: id,
    categoryId: "c",
    accessLevel: "free",
    placement: "floor",
    hidden: false,
    allowedMerchantIds: [],
    currentVersion: makeVersion(`ver-${id}`, id),
    createdAt: "2026-10-25T00:00:00Z",
    updatedAt: "2026-10-25T00:00:00Z",
    ...overrides,
  };
}

function versionsFor(...assets: RoomAsset[]) {
  return new Map(assets.map((a) => [a.currentVersion.id, { version: a.currentVersion, asset: a }]));
}

const freeMerchant = { id: "m-free", plan: "free" as const };

describe("validateSceneSave", () => {
  const plant = makeAsset("plant");
  const proLamp = makeAsset("lamp", { accessLevel: "pro" });
  const frame = makeAsset("frame", { placement: "wall" });
  const versions = versionsFor(plant, proLamp, frame);
  const plantItem = (id: string) => item(0, { id, assetId: "plant", versionId: "ver-plant" });
  const lampItem = (id: string) => item(0, { id, assetId: "lamp", versionId: "ver-lamp" });

  const save = (next: SceneItem[], previous: SceneItem[] | null) =>
    validateSceneSave({
      next: sceneWith(next),
      previous: previous ? sceneWith(previous) : null,
      versions,
      merchant: freeMerchant,
    });

  it("rejects an unknown version id with 400", () => {
    const result = save([item(0, { id: "a", versionId: "nope" })], null);
    expect(result).toMatchObject({ ok: false, status: 400 });
  });

  it("rejects an asset id that does not match the version's asset with 400", () => {
    const result = save([item(0, { id: "a", assetId: "lamp", versionId: "ver-plant" })], null);
    expect(result).toMatchObject({ ok: false, status: 400 });
  });

  it("rejects a new wall item with 400", () => {
    const result = save([item(0, { id: "a", assetId: "frame", versionId: "ver-frame" })], null);
    expect(result).toMatchObject({ ok: false, status: 400 });
  });

  it("rejects a new item using a locked asset with 403", () => {
    expect(save([lampItem("a")], null)).toMatchObject({ ok: false, status: 403 });
  });

  it("accepts an already-saved locked item", () => {
    expect(save([lampItem("a")], [lampItem("a")])).toEqual({ ok: true });
  });

  it("rejects a second new copy of a locked asset with 403", () => {
    expect(save([lampItem("a"), lampItem("b")], [lampItem("a")])).toMatchObject({
      ok: false,
      status: 403,
    });
  });

  it("accepts a free asset", () => {
    expect(save([plantItem("a")], null)).toEqual({ ok: true });
  });

  it("accepts removing every item even when the previous scene held locked items", () => {
    expect(save([], [lampItem("a")])).toEqual({ ok: true });
  });

  it("treats every item as new when there is no previous scene", () => {
    expect(save([lampItem("a")], null)).toMatchObject({ ok: false, status: 403 });
  });

  it("rejects a saved item id that is switched to a locked asset", () => {
    const swapped = { ...lampItem("a"), id: "a" };
    expect(save([swapped], [plantItem("a")])).toMatchObject({ ok: false, status: 403 });
  });

  it("rejects a saved item id that is switched to a wall asset", () => {
    const swapped = item(0, { id: "a", assetId: "frame", versionId: "ver-frame" });
    expect(save([swapped], [plantItem("a")])).toMatchObject({ ok: false, status: 400 });
  });

  it("names the locked asset in the 403 message", () => {
    const result = save([lampItem("a")], null);
    expect(result.ok === false && result.error).toContain("lamp");
  });
});

describe("isUuid", () => {
  it("accepts a v4 uuid", () => {
    expect(isUuid("0967e6d8-7b09-4c0d-a04d-146226b799c7")).toBe(true);
  });

  it.each([["nope"], [""], ["0967e6d8-7b09-4c0d-a04d"], ["0967e6d87b094c0da04d146226b799c7"], ["x967e6d8-7b09-4c0d-a04d-146226b799c7"]])(
    "rejects %s",
    (value) => {
      expect(isUuid(value)).toBe(false);
    }
  );
});

describe("DirtyTracker", () => {
  it("starts clean", () => {
    expect(new DirtyTracker().dirty).toBe(false);
  });

  it("becomes dirty after a change and clean after clearing the same revision", () => {
    const tracker = new DirtyTracker();
    tracker.touch();
    expect(tracker.dirty).toBe(true);
    tracker.clear(tracker.revision);
    expect(tracker.dirty).toBe(false);
  });

  it("stays dirty when a change happened after the revision being cleared", () => {
    const tracker = new DirtyTracker();
    tracker.touch();
    const saved = tracker.revision;
    tracker.touch();
    tracker.clear(saved);
    expect(tracker.dirty).toBe(true);
  });

  it("clears unconditionally when no revision is given", () => {
    const tracker = new DirtyTracker();
    tracker.touch();
    tracker.touch();
    tracker.clear();
    expect(tracker.dirty).toBe(false);
  });
});
