export type AssetAccessLevel = "free" | "pro" | "selected";
export type MerchantPlan = "free" | "pro";
export type AssetPlacement = "floor" | "wall";

export const ASSET_CATEGORY_ICONS = [
  "leaf",
  "lamp",
  "frame",
  "sofa",
  "table",
  "flower",
  "book",
  "shapes",
] as const;

export type AssetCategoryIcon = (typeof ASSET_CATEGORY_ICONS)[number];

export interface AssetCategory {
  id: string;
  name: string;
  icon: AssetCategoryIcon;
  sortOrder: number;
}

export interface AssetVersion {
  id: string;
  assetId: string;
  version: number;
  glbUrl: string;
  storagePath: string;
  previewUrl: string | null;
  widthCm: number;
  depthCm: number;
  heightCm: number;
  fileSizeBytes: number;
  createdAt: string;
}

export interface RoomAsset {
  id: string;
  name: string;
  categoryId: string;
  accessLevel: AssetAccessLevel;
  placement: AssetPlacement;
  hidden: boolean;
  allowedMerchantIds: string[];
  currentVersion: AssetVersion;
  createdAt: string;
  updatedAt: string;
}

export interface MerchantAssetView extends Omit<RoomAsset, "allowedMerchantIds"> {
  locked: boolean;
}
