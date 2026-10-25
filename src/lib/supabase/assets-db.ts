import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseClient } from "./db";
import { isUuid } from "../assets/ids";
import type {
  AssetAccessLevel,
  AssetCategory,
  AssetCategoryIcon,
  AssetPlacement,
  AssetVersion,
  RoomAsset,
} from "../assets/types";

const UNIQUE_VIOLATION = "23505";

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export type NewAssetVersion = Omit<AssetVersion, "id" | "createdAt" | "version">;

export interface NewAssetInput {
  id: string;
  name: string;
  categoryId: string;
  accessLevel: AssetAccessLevel;
  placement: AssetPlacement;
  allowedMerchantIds: string[];
}

export interface AssetPatch {
  name?: string;
  categoryId?: string;
  accessLevel?: AssetAccessLevel;
  placement?: AssetPlacement;
  hidden?: boolean;
  allowedMerchantIds?: string[];
}

function mapCategory(row: Row): AssetCategory {
  return {
    id: row.id,
    name: row.name,
    icon: row.icon as AssetCategoryIcon,
    sortOrder: row.sort_order,
  };
}

function mapVersion(row: Row): AssetVersion {
  return {
    id: row.id,
    assetId: row.asset_id,
    version: row.version,
    glbUrl: row.glb_url,
    storagePath: row.storage_path,
    previewUrl: row.preview_url,
    widthCm: Number(row.width_cm),
    depthCm: Number(row.depth_cm),
    heightCm: Number(row.height_cm),
    fileSizeBytes: row.file_size_bytes,
    createdAt: row.created_at,
  };
}

class AssetsDbService {
  private get client(): SupabaseClient {
    const client = getSupabaseClient();
    if (!client) throw new Error("Supabase is not configured");
    return client;
  }

  async listCategories(): Promise<AssetCategory[]> {
    const { data, error } = await this.client
      .from("room_asset_categories")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []).map(mapCategory);
  }

  async createCategory(name: string, icon: AssetCategoryIcon): Promise<AssetCategory> {
    const { data, error } = await this.client
      .from("room_asset_categories")
      .insert({ name, icon })
      .select("*")
      .single();
    if (error) throw new Error(error.code === UNIQUE_VIOLATION ? "duplicate" : error.message);
    return mapCategory(data);
  }

  async deleteCategory(id: string): Promise<"deleted" | "in_use"> {
    const { count, error: countError } = await this.client
      .from("room_assets")
      .select("id", { count: "exact", head: true })
      .eq("category_id", id);
    if (countError) throw new Error(countError.message);
    if (count) return "in_use";

    const { error } = await this.client.from("room_asset_categories").delete().eq("id", id);
    if (error) throw new Error(error.message);
    return "deleted";
  }

  private async hydrate(assetRows: Row[]): Promise<RoomAsset[]> {
    if (assetRows.length === 0) return [];
    const assetIds = assetRows.map((a) => a.id);
    const versionIds = assetRows.map((a) => a.current_version_id).filter(Boolean);

    const [versions, access] = await Promise.all([
      this.client.from("room_asset_versions").select("*").in("id", versionIds),
      this.client.from("room_asset_access").select("*").in("asset_id", assetIds),
    ]);
    if (versions.error) throw new Error(versions.error.message);
    if (access.error) throw new Error(access.error.message);

    const merchantIds = [...new Set((access.data ?? []).map((a) => a.merchant_id as string))];
    const knownMerchants = new Set<string>();
    if (merchantIds.length > 0) {
      const { data } = await this.client.from("app_users").select("id").in("id", merchantIds);
      (data ?? []).forEach((u) => knownMerchants.add(u.id));
    }

    const versionById = new Map((versions.data ?? []).map((v) => [v.id, mapVersion(v)]));

    return assetRows.flatMap((row) => {
      const currentVersion = versionById.get(row.current_version_id);
      if (!currentVersion) return [];
      return [
        {
          id: row.id,
          name: row.name,
          categoryId: row.category_id,
          accessLevel: row.access_level as AssetAccessLevel,
          placement: row.placement as AssetPlacement,
          hidden: row.hidden,
          allowedMerchantIds: (access.data ?? [])
            .filter((a) => a.asset_id === row.id && knownMerchants.has(a.merchant_id))
            .map((a) => a.merchant_id as string),
          currentVersion,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        },
      ];
    });
  }

  async listAssets(): Promise<RoomAsset[]> {
    const { data, error } = await this.client
      .from("room_assets")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return this.hydrate(data ?? []);
  }

  async getVersionsWithAssets(
    versionIds: string[]
  ): Promise<Map<string, { version: AssetVersion; asset: RoomAsset }>> {
    const result = new Map<string, { version: AssetVersion; asset: RoomAsset }>();
    const validIds = versionIds.filter(isUuid);
    if (validIds.length === 0) return result;

    const { data: versionRows, error } = await this.client
      .from("room_asset_versions")
      .select("*")
      .in("id", validIds);
    if (error) throw new Error(error.message);
    if (!versionRows?.length) return result;

    const assetIds = [...new Set(versionRows.map((v) => v.asset_id as string))];
    const { data: assetRows, error: assetError } = await this.client
      .from("room_assets")
      .select("*")
      .in("id", assetIds);
    if (assetError) throw new Error(assetError.message);

    const assets = new Map((await this.hydrate(assetRows ?? [])).map((a) => [a.id, a]));
    for (const row of versionRows) {
      const asset = assets.get(row.asset_id);
      if (asset) result.set(row.id, { version: mapVersion(row), asset });
    }
    return result;
  }

  async getAsset(id: string): Promise<RoomAsset | null> {
    const { data, error } = await this.client
      .from("room_assets")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    return (await this.hydrate([data]))[0] ?? null;
  }

  private async insertVersion(
    assetId: string,
    version: number,
    input: NewAssetVersion
  ): Promise<AssetVersion> {
    const { data, error } = await this.client
      .from("room_asset_versions")
      .insert({
        asset_id: assetId,
        version,
        glb_url: input.glbUrl,
        storage_path: input.storagePath,
        preview_url: input.previewUrl,
        width_cm: input.widthCm,
        depth_cm: input.depthCm,
        height_cm: input.heightCm,
        file_size_bytes: input.fileSizeBytes,
      })
      .select("*")
      .single();
    if (error) {
      throw new Error(error.code === UNIQUE_VIOLATION ? "version_conflict" : error.message);
    }
    return mapVersion(data);
  }

  private async setCurrentVersion(assetId: string, versionId: string): Promise<void> {
    const { error } = await this.client
      .from("room_assets")
      .update({ current_version_id: versionId, updated_at: new Date().toISOString() })
      .eq("id", assetId);
    if (error) throw new Error(error.message);
  }

  private async replaceAllowList(assetId: string, merchantIds: string[]): Promise<void> {
    const { error: deleteError } = await this.client
      .from("room_asset_access")
      .delete()
      .eq("asset_id", assetId);
    if (deleteError) throw new Error(deleteError.message);

    const unique = [...new Set(merchantIds)];
    if (unique.length === 0) return;
    const { error } = await this.client
      .from("room_asset_access")
      .insert(unique.map((merchant_id) => ({ asset_id: assetId, merchant_id })));
    if (error) throw new Error(error.message);
  }

  async createAsset(input: NewAssetInput, version: NewAssetVersion): Promise<RoomAsset> {
    const { error } = await this.client.from("room_assets").insert({
      id: input.id,
      name: input.name,
      category_id: input.categoryId,
      access_level: input.accessLevel,
      placement: input.placement,
    });
    if (error) throw new Error(error.message);

    try {
      const created = await this.insertVersion(input.id, 1, version);
      await this.setCurrentVersion(input.id, created.id);
      await this.replaceAllowList(input.id, input.allowedMerchantIds);
      const asset = await this.getAsset(input.id);
      if (!asset) throw new Error("Asset was not created");
      return asset;
    } catch (err) {
      await this.client.from("room_assets").delete().eq("id", input.id);
      throw err;
    }
  }

  async addVersion(assetId: string, version: NewAssetVersion): Promise<RoomAsset> {
    const { data: latest, error } = await this.client
      .from("room_asset_versions")
      .select("version")
      .eq("asset_id", assetId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);

    await this.insertVersion(assetId, (latest?.version ?? 0) + 1, version);

    const { data: newest, error: newestError } = await this.client
      .from("room_asset_versions")
      .select("id")
      .eq("asset_id", assetId)
      .order("version", { ascending: false })
      .limit(1)
      .single();
    if (newestError) throw new Error(newestError.message);
    await this.setCurrentVersion(assetId, newest.id);

    const asset = await this.getAsset(assetId);
    if (!asset) throw new Error("Asset not found");
    return asset;
  }

  async updateAsset(id: string, patch: AssetPatch): Promise<RoomAsset | null> {
    const columns: Row = { updated_at: new Date().toISOString() };
    if (patch.name !== undefined) columns.name = patch.name;
    if (patch.categoryId !== undefined) columns.category_id = patch.categoryId;
    if (patch.accessLevel !== undefined) columns.access_level = patch.accessLevel;
    if (patch.placement !== undefined) columns.placement = patch.placement;
    if (patch.hidden !== undefined) columns.hidden = patch.hidden;

    const { data, error } = await this.client
      .from("room_assets")
      .update(columns)
      .eq("id", id)
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;

    if (patch.allowedMerchantIds !== undefined) {
      await this.replaceAllowList(id, patch.allowedMerchantIds);
    }
    return this.getAsset(id);
  }
}

export const assetsDb = new AssetsDbService();
