import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { resolvePalette } from "../src/components/studio/backdrop";
import {
  BACKDROP_MODES,
  STUDIO_PRESETS,
  isBackdropMode,
  presetPreviewGradient,
} from "../src/lib/scenes/backdrops";
import { sceneSchema } from "../src/lib/scenes/schema";
import { EMPTY_SCENE } from "../src/lib/scenes/types";

const WHITE = "hsl(0 0% 100%)";

describe("resolvePalette", () => {
  it("makes the white backdrop pure white from top to bottom with no darker edge", () => {
    expect(resolvePalette("white", null)).toEqual({ top: WHITE, floor: WHITE, edge: WHITE });
    expect(resolvePalette("white", { h: 0.04, s: 0.7, l: 0.4 })).toEqual({
      top: WHITE,
      floor: WHITE,
      edge: WHITE,
    });
  });

  it("keeps the studio grey gradient darker at the top and edges", () => {
    const palette = resolvePalette("studio", null);
    expect(palette.top).not.toBe(palette.floor);
    expect(palette.edge).not.toBe(WHITE);
  });

  it("keeps the auto backdrop tinted by the product when a tone is known", () => {
    const palette = resolvePalette("auto", { h: 0.04, s: 0.7, l: 0.4 });
    expect(palette.top).not.toBe(WHITE);
  });
});

function lightnessOf(css: string): number {
  const match = css.match(/hsl\((\d+) (\d+)% (\d+)%/);
  expect(match).not.toBeNull();
  return Number(match![3]);
}

describe("studio backdrop presets", () => {
  const modes = STUDIO_PRESETS.map((preset) => preset.mode);

  it("offers the eight studio variants in three groups", () => {
    expect(modes).toEqual(["ivory", "sand", "blush", "sage", "mocha", "slate", "charcoal", "midnight"]);
    expect(new Set(STUDIO_PRESETS.map((p) => p.group))).toEqual(new Set(["light", "colour", "dark"]));
  });

  it("keeps every older mode and adds the new ones to the accepted modes", () => {
    for (const mode of ["auto", "studio", "white", "transparent", ...modes]) {
      expect(BACKDROP_MODES).toContain(mode);
      expect(isBackdropMode(mode)).toBe(true);
    }
    expect(BACKDROP_MODES).toHaveLength(12);
    expect(isBackdropMode("neon")).toBe(false);
  });

  it("saves any accepted backdrop in a scene and rejects an unknown one", () => {
    for (const backdrop of BACKDROP_MODES) {
      expect(sceneSchema.safeParse({ ...EMPTY_SCENE, backdrop }).success).toBe(true);
    }
    expect(sceneSchema.safeParse({ ...EMPTY_SCENE, backdrop: "neon" }).success).toBe(false);
  });

  it.each(modes)("builds a lit cyclorama palette for %s", (mode) => {
    const palette = resolvePalette(mode, null);
    expect(palette.spot?.alpha).toBeGreaterThan(0);
    expect(palette.grain).toBe(true);
    expect(lightnessOf(palette.floor)).toBeGreaterThan(lightnessOf(palette.top));
    expect(lightnessOf(palette.edge)).toBeLessThan(lightnessOf(palette.top));
    for (const css of [palette.top, palette.floor, palette.edge, palette.spot!.color]) {
      expect(() => new THREE.Color().setStyle(css)).not.toThrow();
    }
  });

  it("makes dark variants clearly darker than light ones", () => {
    const light = lightnessOf(resolvePalette("ivory", null).top);
    const dark = lightnessOf(resolvePalette("charcoal", null).top);
    expect(dark).toBeLessThan(25);
    expect(light).toBeGreaterThan(80);
  });

  it("gives every preset a preview gradient for the menu", () => {
    for (const preset of STUDIO_PRESETS) {
      expect(presetPreviewGradient(preset.mode)).toMatch(/^linear-gradient\(/);
    }
  });

  it("keeps white and studio grey free of the new lighting effects", () => {
    expect(resolvePalette("white", null).spot).toBeUndefined();
    expect(resolvePalette("studio", null).grain).toBeUndefined();
  });
});
