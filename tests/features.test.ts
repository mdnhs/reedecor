import { describe, it, expect } from "vitest";
import {
  FEATURES,
  FEATURE_KEYS,
  featureOffMessage,
  isFeatureKey,
  resolveFlags,
} from "../src/lib/features/catalog";

describe("feature catalogue", () => {
  it("has eight unique keys matching FEATURE_KEYS", () => {
    const keys = FEATURES.map((feature) => feature.key);
    expect(keys).toHaveLength(8);
    expect(new Set(keys).size).toBe(8);
    expect(keys).toEqual([...FEATURE_KEYS]);
  });

  it("describes every feature", () => {
    for (const feature of FEATURES) {
      expect(feature.label.length).toBeGreaterThan(0);
      expect(feature.description.length).toBeGreaterThan(0);
    }
  });

  it("recognises feature keys", () => {
    for (const key of FEATURE_KEYS) expect(isFeatureKey(key)).toBe(true);
    expect(isFeatureKey("nope")).toBe(false);
    expect(isFeatureKey("")).toBe(false);
  });

  it("explains a refused request", () => {
    expect(featureOffMessage).toBe("This feature is turned off by the administrator.");
  });
});

describe("resolveFlags", () => {
  it("enables everything when there are no rows", () => {
    expect(Object.values(resolveFlags([])).every(Boolean)).toBe(true);
  });

  it("turns off only the features that have a disabled row", () => {
    const flags = resolveFlags([{ key: "wishlist", enabled: false }]);
    expect(flags.wishlist).toBe(false);
    expect(flags.whatsapp_contact).toBe(true);
  });

  it("ignores unknown keys", () => {
    const flags = resolveFlags([{ key: "mystery", enabled: false }]);
    expect(Object.keys(flags).sort()).toEqual([...FEATURE_KEYS].sort());
    expect(Object.values(flags).every(Boolean)).toBe(true);
  });

  it("lets a later row for the same key win", () => {
    const flags = resolveFlags([
      { key: "wishlist", enabled: false },
      { key: "wishlist", enabled: true },
    ]);
    expect(flags.wishlist).toBe(true);
  });
});
