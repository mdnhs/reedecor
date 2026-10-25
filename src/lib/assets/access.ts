import type { MerchantAssetView, MerchantPlan, RoomAsset } from "./types";

interface MerchantRef {
  id: string;
  plan?: MerchantPlan | null;
}

export function canUseAsset(
  asset: Pick<RoomAsset, "accessLevel" | "allowedMerchantIds">,
  merchant: MerchantRef
): boolean {
  if (asset.accessLevel === "free") return true;
  if (asset.accessLevel === "pro") return merchant.plan === "pro";
  return asset.allowedMerchantIds.includes(merchant.id);
}

export function toMerchantView(
  asset: RoomAsset,
  merchant: MerchantRef
): MerchantAssetView | null {
  if (asset.hidden) return null;
  const view: MerchantAssetView & { allowedMerchantIds?: string[] } = {
    ...asset,
    locked: !canUseAsset(asset, merchant),
  };
  delete view.allowedMerchantIds;
  return view;
}

export function normalizePlan(value: unknown): MerchantPlan {
  return value === "pro" ? "pro" : "free";
}
