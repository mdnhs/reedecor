import { canUseAsset } from "@/lib/assets/access";
import type { AssetVersion, MerchantPlan, RoomAsset } from "@/lib/assets/types";
import type { SceneData } from "./types";

export type SceneSaveResult =
  | { ok: true }
  | { ok: false; error: string; status: 400 | 403 };

export function validateSceneSave(args: {
  next: SceneData;
  previous: SceneData | null;
  versions: Map<string, { version: AssetVersion; asset: RoomAsset }>;
  merchant: { id: string; plan?: MerchantPlan | null };
}): SceneSaveResult {
  const savedKeys = new Set(args.previous?.items.map((item) => `${item.id}:${item.versionId}`) ?? []);

  for (const item of args.next.items) {
    const found = args.versions.get(item.versionId);
    if (!found || found.asset.id !== item.assetId) {
      return { ok: false, error: "Scene references an unknown asset.", status: 400 };
    }
    if (savedKeys.has(`${item.id}:${item.versionId}`)) continue;

    if (found.asset.placement === "wall") {
      return {
        ok: false,
        error: `"${found.asset.name}" is a wall item. Wall items are not supported yet.`,
        status: 400,
      };
    }
    if (!canUseAsset(found.asset, args.merchant)) {
      return {
        ok: false,
        error: `You do not have access to "${found.asset.name}".`,
        status: 403,
      };
    }
  }

  return { ok: true };
}
