import type { BackdropMode } from "@/components/studio/backdrop";
import type { AssetPlacement } from "@/lib/assets/types";

export const MAX_SCENE_ITEMS = 20;
export const SCALE_RANGE = { min: 0.2, max: 5 } as const;
export const MAX_OFFSET_CM = 500;

export interface SceneItem {
  id: string;
  assetId: string;
  versionId: string;
  x: number;
  z: number;
  rotationY: number;
  scale: number;
}

export interface SceneData {
  schemaVersion: 1;
  backdrop: BackdropMode;
  items: SceneItem[];
}

export const EMPTY_SCENE: SceneData = { schemaVersion: 1, backdrop: "auto", items: [] };

export interface ResolvedSceneItem extends SceneItem {
  glbUrl: string;
  widthCm: number;
  depthCm: number;
  heightCm: number;
  placement: AssetPlacement;
}

export interface ResolvedScene {
  schemaVersion: 1;
  backdrop: BackdropMode;
  items: ResolvedSceneItem[];
}
