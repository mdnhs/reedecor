import * as THREE from "three";
import type { ProductTone } from "@/components/studio/backdrop";

export const FLOOR_TYPES = ["oak", "walnut", "concrete", "tile"] as const;
export type FloorType = (typeof FLOOR_TYPES)[number];

export interface RoomSettings {
  enabled: boolean;
  wallColor: string;
  floorType: FloorType;
}

export const ROOM_SIZE_CM = { floor: 600, wallHeight: 280 } as const;

export const NEUTRAL_WALL_COLORS = [
  { name: "White", color: "#f5f5f4" },
  { name: "Greige", color: "#d6d3d1" },
  { name: "Warm stone", color: "#e7e0d5" },
] as const;

export const DEFAULT_ROOM: RoomSettings = {
  enabled: true,
  wallColor: "#e7e0d5",
  floorType: "oak",
};

const HEX_PATTERN = /^#[0-9a-fA-F]{6}$/;
const ANALOGUE_SHIFT = 30 / 360;
const MAX_SATURATION = 0.25;

export function isHexColor(value: string): boolean {
  return HEX_PATTERN.test(value);
}

function hslToHex(h: number, s: number, l: number): string {
  return `#${new THREE.Color().setHSL(((h % 1) + 1) % 1, s, l, THREE.SRGBColorSpace).getHexString()}`;
}

export function suggestWallColors(tone: ProductTone | null): string[] {
  if (!tone) return NEUTRAL_WALL_COLORS.slice(0, 3).map((neutral) => neutral.color);

  const muted = Math.min(tone.s, MAX_SATURATION);
  return [
    hslToHex(tone.h, muted * 0.6, 0.9),
    hslToHex(tone.h + 0.5, muted * 0.5, 0.85),
    hslToHex(tone.h + ANALOGUE_SHIFT, muted * 0.5, 0.8),
  ];
}

export function roomsEqual(a: RoomSettings | undefined, b: RoomSettings | undefined): boolean {
  const left = a?.enabled ? a : null;
  const right = b?.enabled ? b : null;
  if (!left || !right) return left === right;
  return (
    left.wallColor.toLowerCase() === right.wallColor.toLowerCase() &&
    left.floorType === right.floorType
  );
}
