import { getSupabaseClient } from "./db";
import type { FeatureKey } from "@/lib/features/catalog";

export interface StoredFlag {
  key: string;
  enabled: boolean;
  updatedAt: string | null;
  updatedBy: string | null;
}

class FeaturesDbService {
  async list(): Promise<StoredFlag[]> {
    const client = getSupabaseClient();
    if (!client) return [];

    const { data, error } = await client.from("feature_flags").select("*");
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => ({
      key: row.key,
      enabled: row.enabled,
      updatedAt: row.updated_at ?? null,
      updatedBy: row.updated_by ?? null,
    }));
  }

  async set(key: FeatureKey, enabled: boolean, userId: string): Promise<void> {
    const client = getSupabaseClient();
    if (!client) throw new Error("Supabase is not configured");

    const { error } = await client.from("feature_flags").upsert({
      key,
      enabled,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
  }
}

export const featuresDb = new FeaturesDbService();
