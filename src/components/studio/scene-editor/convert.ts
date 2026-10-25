import { MAX_OFFSET_CM, SCALE_RANGE, type SceneItem } from "@/lib/scenes/types";

const TWO_PI = Math.PI * 2;

export function clampScale(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(SCALE_RANGE.max, Math.max(SCALE_RANGE.min, value));
}

function clampOffset(value: number): number {
  return Math.min(MAX_OFFSET_CM, Math.max(-MAX_OFFSET_CM, value));
}

function normaliseRotation(radians: number): number {
  const wrapped = (((radians + Math.PI) % TWO_PI) + TWO_PI) % TWO_PI;
  return wrapped - Math.PI;
}

export function itemToTransform(
  item: Pick<SceneItem, "x" | "z" | "rotationY">,
  worldPerCm: number
): { position: [number, number, number]; rotationY: number } {
  return { position: [item.x * worldPerCm, 0, item.z * worldPerCm], rotationY: item.rotationY };
}

export function transformToItemFields(
  position: { x: number; z: number },
  rotationY: number,
  scale: number,
  worldPerCm: number
): Pick<SceneItem, "x" | "z" | "rotationY" | "scale"> {
  return {
    x: clampOffset(position.x / worldPerCm),
    z: clampOffset(position.z / worldPerCm),
    rotationY: normaliseRotation(rotationY),
    scale: clampScale(scale),
  };
}
