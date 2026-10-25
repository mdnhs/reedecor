import { describe, it, expect } from "vitest";
import {
  clampScale,
  itemToTransform,
  transformToItemFields,
} from "../src/components/studio/scene-editor/convert";
import type { SceneItem } from "../src/lib/scenes/types";

const item: SceneItem = {
  id: "i1",
  assetId: "a",
  versionId: "v",
  x: 40,
  z: -25,
  rotationY: 1.2,
  scale: 1.5,
};

describe("scene item conversion", () => {
  it("places an item in world units from centimetres", () => {
    const { position, rotationY } = itemToTransform(item, 0.01);
    expect(position[0]).toBeCloseTo(0.4);
    expect(position[1]).toBe(0);
    expect(position[2]).toBeCloseTo(-0.25);
    expect(rotationY).toBe(1.2);
  });

  it("round-trips an item through world units", () => {
    const { position, rotationY } = itemToTransform(item, 0.0123);
    const fields = transformToItemFields({ x: position[0], z: position[2] }, rotationY, item.scale, 0.0123);
    expect(fields.x).toBeCloseTo(item.x, 6);
    expect(fields.z).toBeCloseTo(item.z, 6);
    expect(fields.rotationY).toBeCloseTo(item.rotationY, 6);
    expect(fields.scale).toBeCloseTo(item.scale, 6);
  });

  it("clamps scale to the allowed range", () => {
    expect(transformToItemFields({ x: 0, z: 0 }, 0, 0.01, 0.01).scale).toBe(0.2);
    expect(transformToItemFields({ x: 0, z: 0 }, 0, 99, 0.01).scale).toBe(5);
  });

  it("clamps offsets to 500 cm", () => {
    const fields = transformToItemFields({ x: 100, z: -100 }, 0, 1, 0.01);
    expect(fields.x).toBe(500);
    expect(fields.z).toBe(-500);
  });

  it("normalises rotation into -PI..PI", () => {
    const fields = transformToItemFields({ x: 0, z: 0 }, 3 * Math.PI, 1, 0.01);
    expect(Math.abs(Math.abs(fields.rotationY) - Math.PI)).toBeLessThan(1e-6);
  });

  it("falls back to 1 for a non-finite scale", () => {
    expect(clampScale(NaN)).toBe(1);
    expect(clampScale(Infinity)).toBe(1);
  });
});
