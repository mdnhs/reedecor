import { describe, it, expect } from "vitest";
import * as THREE from "three";
import {
  DEFAULT_ROOM,
  NEUTRAL_WALL_COLORS,
  isHexColor,
  roomsEqual,
  suggestWallColors,
} from "../src/lib/scenes/room";
import { sceneSchema } from "../src/lib/scenes/schema";
import { EMPTY_SCENE } from "../src/lib/scenes/types";

function hslOf(hex: string) {
  const hsl = { h: 0, s: 0, l: 0 };
  new THREE.Color(hex).getHSL(hsl, THREE.SRGBColorSpace);
  return hsl;
}

describe("room in the scene schema", () => {
  it("accepts a scene without a room", () => {
    expect(sceneSchema.safeParse(EMPTY_SCENE).success).toBe(true);
  });

  it("accepts the default room and a disabled room", () => {
    expect(sceneSchema.safeParse({ ...EMPTY_SCENE, room: DEFAULT_ROOM }).success).toBe(true);
    expect(sceneSchema.safeParse({ ...EMPTY_SCENE, room: { ...DEFAULT_ROOM, enabled: false } }).success).toBe(true);
  });

  it.each([["red"], ["#12"], ["#GGGGGG"], ["javascript:alert(1)"], [""], ["#12345678"]])(
    "rejects wall colour %s",
    (wallColor) => {
      expect(sceneSchema.safeParse({ ...EMPTY_SCENE, room: { ...DEFAULT_ROOM, wallColor } }).success).toBe(false);
    }
  );

  it("rejects an unknown floor type", () => {
    const room = { ...DEFAULT_ROOM, floorType: "lava" };
    expect(sceneSchema.safeParse({ ...EMPTY_SCENE, room }).success).toBe(false);
  });
});

describe("isHexColor", () => {
  it("requires a leading hash and six hex digits", () => {
    expect(isHexColor("#a1B2c3")).toBe(true);
    expect(isHexColor("a1b2c3")).toBe(false);
    expect(isHexColor("#a1b2c")).toBe(false);
  });
});

describe("suggestWallColors", () => {
  it("returns the first three neutrals without a product tone", () => {
    expect(suggestWallColors(null)).toEqual(NEUTRAL_WALL_COLORS.slice(0, 3).map((n) => n.color));
  });

  it.each([
    ["terracotta", { h: 0.04, s: 0.7, l: 0.4 }],
    ["burgundy", { h: 0.98, s: 0.6, l: 0.2 }],
    ["grey", { h: 0, s: 0, l: 0.5 }],
  ])("gives three distinct light, muted colours for a %s product", (_name, tone) => {
    const colors = suggestWallColors(tone);
    expect(colors).toHaveLength(3);
    expect(new Set(colors).size).toBe(3);
    for (const color of colors) {
      expect(isHexColor(color)).toBe(true);
      const { s, l } = hslOf(color);
      expect(l).toBeGreaterThanOrEqual(0.78);
      expect(s).toBeLessThanOrEqual(0.26);
    }
  });
});

describe("roomsEqual", () => {
  const on = { ...DEFAULT_ROOM, enabled: true };

  it("treats a missing room and a disabled room as the same", () => {
    expect(roomsEqual(undefined, { ...on, enabled: false })).toBe(true);
    expect(roomsEqual({ ...on, enabled: false }, { ...on, wallColor: "#ffffff", enabled: false })).toBe(true);
  });

  it("treats an enabled room as different from none or a disabled one", () => {
    expect(roomsEqual(on, undefined)).toBe(false);
    expect(roomsEqual(on, { ...on, enabled: false })).toBe(false);
  });

  it("compares colour and floor of two enabled rooms", () => {
    expect(roomsEqual(on, { ...on })).toBe(true);
    expect(roomsEqual(on, { ...on, wallColor: "#ffffff" })).toBe(false);
    expect(roomsEqual(on, { ...on, floorType: "tile" })).toBe(false);
  });

  it("ignores letter case of the colour", () => {
    expect(roomsEqual({ ...on, wallColor: "#E7E0D5" }, { ...on, wallColor: "#e7e0d5" })).toBe(true);
  });
});
