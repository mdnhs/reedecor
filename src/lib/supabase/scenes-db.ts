import { getSupabaseClient } from "./db";
import { sceneSchema } from "@/lib/scenes/schema";
import type { SceneData } from "@/lib/scenes/types";

class ScenesDbService {
  async get(productId: string): Promise<SceneData | null> {
    const client = getSupabaseClient();
    if (!client) return null;

    const { data, error } = await client
      .from("product_scenes")
      .select("scene")
      .eq("product_id", productId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;

    const parsed = sceneSchema.safeParse(data.scene);
    return parsed.success ? parsed.data : null;
  }

  async upsert(productId: string, scene: SceneData, userId: string): Promise<void> {
    const client = getSupabaseClient();
    if (!client) throw new Error("Supabase is not configured");

    const { error } = await client.from("product_scenes").upsert({
      product_id: productId,
      scene,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
  }
}

export const scenesDb = new ScenesDbService();
