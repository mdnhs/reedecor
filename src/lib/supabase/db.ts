import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { resolveSupabaseConfig } from "./config";
import { StoredProduct } from "@/server/demo-store";
import { toPublicStore, type PublicStore } from "@/lib/public-store";
import { storageService } from "@/lib/storage/supabase-storage";

let supabaseClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  const config = resolveSupabaseConfig();
  if (!config) return null;
  if (!supabaseClient) {
    supabaseClient = createClient(config.url, config.key, {
      auth: { persistSession: false },
    });
  }
  return supabaseClient;
}

const MERCHANT_USER_COLUMNS = "id, name, email, role, business_name, bio, whatsapp_number, location";

export interface MerchantUserRow {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
  business_name: string | null;
  bio: string | null;
  whatsapp_number: string | null;
  location: string | null;
}

export class SupabaseDbService {
  private client: SupabaseClient | null;

  constructor() {
    this.client = getSupabaseClient();
  }

  getClient(): SupabaseClient | null {
    if (!this.client) {
      this.client = getSupabaseClient();
    }
    return this.client;
  }

  isConfigured(): boolean {
    return this.getClient() !== null;
  }

  async getAllProducts(): Promise<StoredProduct[]> {
    if (!this.client) return [];

    const { data: productsData, error: prodErr } = await this.client
      .from("products")
      .select("*, product_images(*), generation_attempts(*)")
      .order("created_at", { ascending: false });

    if (prodErr) throw new Error(prodErr.message);
    if (!productsData || productsData.length === 0) return [];

    return productsData.map((p) => {
      const imagesData = (p.product_images || []) as Array<{
        id: string;
        view_type: "front" | "back" | "left" | "right" | "single";
        public_url: string;
        storage_path: string;
        file_name: string;
        mime_type: string;
        file_size_bytes: number;
      }>;
      const attemptsData = (p.generation_attempts || []) as Array<{
        id: string;
        provider: "meshy" | "tripo" | "mock";
        provider_task_id: string | null;
        status: "pending" | "processing" | "completed" | "failed";
        model_url: string | null;
        credit_cost_estimate: number;
        error_code: string | null;
        error_message: string | null;
        created_at: string;
        completed_at: string | null;
      }>;

      // Sort generation attempts descending by created_at
      const sortedAttempts = [...attemptsData].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      return {
        id: p.id,
        merchantId: p.merchant_id,
        name: p.name,
        category: p.category,
        description: p.description,
        widthMm: p.width_mm,
        depthMm: p.depth_mm,
        heightMm: p.height_mm,
        priceBdt: Number(p.price_bdt || 0),
        status: p.status,
        thumbnailUrl: p.thumbnail_url ?? null,
        createdAt: p.created_at,
        updatedAt: p.updated_at,
        images: imagesData.map((img) => ({
          id: img.id,
          viewType: img.view_type,
          publicUrl: img.public_url,
          storagePath: img.storage_path,
          fileName: img.file_name,
          mimeType: img.mime_type,
          fileSizeBytes: img.file_size_bytes,
        })),
        generationAttempts: sortedAttempts.map((att) => ({
          id: att.id,
          provider: att.provider,
          providerTaskId: att.provider_task_id,
          status: att.status === "pending" ? "queued" : att.status,
          modelUrl: att.model_url,
          creditCostEstimate: Number(att.credit_cost_estimate || 20),
          errorCode: att.error_code,
          errorMessage: att.error_message,
          createdAt: att.created_at,
          completedAt: att.completed_at,
        })),
      };
    });
  }

  async getProductById(id: string): Promise<StoredProduct | null> {
    if (!this.client) return null;

    try {
      const { data: p, error } = await this.client
        .from("products")
        .select("*, product_images(*), generation_attempts(*)")
        .eq("id", id)
        .maybeSingle();

      if (error || !p) return null;

      const imagesData = (p.product_images || []) as Array<{
        id: string;
        view_type: "front" | "back" | "left" | "right" | "single";
        public_url: string;
        storage_path: string;
        file_name: string;
        mime_type: string;
        file_size_bytes: number;
      }>;
      const attemptsData = (p.generation_attempts || []) as Array<{
        id: string;
        provider: "meshy" | "tripo" | "mock";
        provider_task_id: string | null;
        status: "pending" | "processing" | "completed" | "failed";
        model_url: string | null;
        credit_cost_estimate: number;
        error_code: string | null;
        error_message: string | null;
        created_at: string;
        completed_at: string | null;
      }>;

      const sortedAttempts = [...attemptsData].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      return {
        id: p.id,
        merchantId: p.merchant_id,
        name: p.name,
        category: p.category,
        description: p.description,
        widthMm: p.width_mm,
        depthMm: p.depth_mm,
        heightMm: p.height_mm,
        priceBdt: Number(p.price_bdt || 0),
        status: p.status,
        thumbnailUrl: p.thumbnail_url ?? null,
        createdAt: p.created_at,
        updatedAt: p.updated_at,
        images: imagesData.map((img) => ({
          id: img.id,
          viewType: img.view_type,
          publicUrl: img.public_url,
          storagePath: img.storage_path,
          fileName: img.file_name,
          mimeType: img.mime_type,
          fileSizeBytes: img.file_size_bytes,
        })),
        generationAttempts: sortedAttempts.map((att) => ({
          id: att.id,
          provider: att.provider,
          providerTaskId: att.provider_task_id,
          status: att.status === "pending" ? "queued" : att.status,
          modelUrl: att.model_url,
          creditCostEstimate: Number(att.credit_cost_estimate || 20),
          errorCode: att.error_code,
          errorMessage: att.error_message,
          createdAt: att.created_at,
          completedAt: att.completed_at,
        })),
      };
    } catch (err) {
      console.error("Supabase getProductById error:", err);
      return null;
    }
  }

  async createProduct(product: StoredProduct): Promise<void> {
    const client = this.getClient();
    if (!client) return;

    let finalThumbnailUrl = product.thumbnailUrl;
    if (finalThumbnailUrl && (finalThumbnailUrl.startsWith("data:") || finalThumbnailUrl.length > 2000)) {
      console.warn(`[SupabaseDb] Intercepted base64 thumbnail for product ${product.id}. Auto-uploading to storage bucket...`);
      try {
        if (storageService.uploadBase64Image) {
          const upload = await storageService.uploadBase64Image(
            finalThumbnailUrl,
            `products/${product.id}/thumbnail-${Date.now()}`
          );
          finalThumbnailUrl = upload.publicUrl;
        } else {
          finalThumbnailUrl = null;
        }
      } catch (err) {
        console.error("[SupabaseDb] Failed to upload thumbnail to bucket:", err);
        finalThumbnailUrl = null;
      }
    }

    const { error } = await client.from("products").insert({
      id: product.id,
      merchant_id: product.merchantId,
      name: product.name,
      category: product.category,
      description: product.description,
      width_mm: product.widthMm,
      depth_mm: product.depthMm,
      height_mm: product.heightMm,
      price_bdt: product.priceBdt,
      status: product.status,
      thumbnail_url: finalThumbnailUrl,
      created_at: product.createdAt,
      updated_at: product.updatedAt,
    });
    if (error) throw new Error(error.message);

    if (product.images.length > 0) {
      // Safety guard: ensure NO base64 image data is ever stored in database columns.
      // Auto-upload any base64 data to Supabase Storage bucket first.
      const processedImages = await Promise.all(
        product.images.map(async (img, idx) => {
          let publicUrl = img.publicUrl;
          let storagePath = img.storagePath;

          if (publicUrl && (publicUrl.startsWith("data:") || publicUrl.length > 2000)) {
            console.warn(`[SupabaseDb] Intercepted base64 image data URI for ${img.id}. Auto-uploading to Supabase Storage bucket...`);
            if (storageService.uploadBase64Image) {
              try {
                const upload = await storageService.uploadBase64Image(
                  publicUrl,
                  `products/${product.id}/${img.viewType || "image"}-${Date.now()}-${idx}`
                );
                publicUrl = upload.publicUrl;
                storagePath = upload.path;
              } catch (uploadErr) {
                console.error("[SupabaseDb] Failed to upload base64 image to bucket:", uploadErr);
                throw new Error(
                  "Image data cannot be stored directly in database column. Supabase storage upload failed: " +
                    (uploadErr instanceof Error ? uploadErr.message : String(uploadErr))
                );
              }
            } else {
              throw new Error("Base64 image data cannot be written to database column without storage configured.");
            }
          }

          return {
            id: img.id,
            product_id: product.id,
            view_type: img.viewType,
            storage_path: storagePath || `products/${product.id}/${img.viewType || "single"}.jpg`,
            public_url: publicUrl,
            file_name: img.fileName,
            mime_type: img.mimeType,
            file_size_bytes: img.fileSizeBytes,
            created_at: new Date().toISOString(),
          };
        })
      );

      const { error: imageError } = await client.from("product_images").insert(processedImages);
      if (imageError) throw new Error(imageError.message);
    }
  }

  async deleteProduct(id: string): Promise<void> {
    const client = this.getClient();
    if (!client) return;
    const { error } = await client.from("products").delete().eq("id", id);
    if (error) throw new Error(error.message);
  }

  async updateProductStatus(id: string, status: StoredProduct["status"]): Promise<void> {
    const client = this.getClient();
    if (!client) return;
    const { error } = await client
      .from("products")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw new Error(error.message);
  }

  async updateProductThumbnail(id: string, thumbnailUrl: string): Promise<void> {
    const client = this.getClient();
    if (!client) return;

    let finalThumbnailUrl = thumbnailUrl;
    if (thumbnailUrl && (thumbnailUrl.startsWith("data:") || thumbnailUrl.length > 2000)) {
      console.warn(`[SupabaseDb] Intercepted base64 thumbnail for product ${id}. Auto-uploading to storage bucket...`);
      if (storageService.uploadBase64Image) {
        try {
          const upload = await storageService.uploadBase64Image(
            thumbnailUrl,
            `products/${id}/thumbnail-${Date.now()}`
          );
          finalThumbnailUrl = upload.publicUrl;
        } catch (uploadErr) {
          console.error("[SupabaseDb] Failed to upload thumbnail to bucket:", uploadErr);
          throw new Error(
            "Thumbnail base64 cannot be stored in database column. Supabase storage upload failed: " +
              (uploadErr instanceof Error ? uploadErr.message : String(uploadErr))
          );
        }
      } else {
        throw new Error("Base64 thumbnail cannot be written to database column without storage configured.");
      }
    }

    const { error } = await client
      .from("products")
      .update({ thumbnail_url: finalThumbnailUrl, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw new Error(error.message);
  }

  async addGenerationAttempt(
    productId: string,
    attempt: StoredProduct["generationAttempts"][0]
  ): Promise<void> {
    if (!this.client) return;
    const { error } = await this.client.from("generation_attempts").insert({
      id: attempt.id,
      product_id: productId,
      provider: attempt.provider,
      provider_task_id: attempt.providerTaskId,
      status: attempt.status,
      model_url: attempt.modelUrl,
      credit_cost_estimate: attempt.creditCostEstimate,
      error_code: attempt.errorCode,
      error_message: attempt.errorMessage,
      created_at: attempt.createdAt,
      completed_at: attempt.completedAt,
    });
    if (error) throw new Error(error.message);
  }

  // Returns false when expectedStatus no longer matches, so a racing cancel or poll is not overwritten
  async updateGenerationAttempt(
    attemptId: string,
    updates: Partial<StoredProduct["generationAttempts"][0]>,
    expectedStatus?: StoredProduct["generationAttempts"][0]["status"]
  ): Promise<boolean> {
    if (!this.client) return true;
    const mapped: Record<string, unknown> = {};
    if (updates.status) mapped.status = updates.status;
    if (updates.providerTaskId !== undefined) mapped.provider_task_id = updates.providerTaskId;
    if (updates.creditCostEstimate !== undefined) mapped.credit_cost_estimate = updates.creditCostEstimate;
    if (updates.modelUrl !== undefined) mapped.model_url = updates.modelUrl;
    if (updates.errorMessage !== undefined) mapped.error_message = updates.errorMessage;
    if (updates.errorCode !== undefined) mapped.error_code = updates.errorCode;
    if (updates.completedAt !== undefined) mapped.completed_at = updates.completedAt;
    mapped.updated_at = new Date().toISOString();

    let query = this.client.from("generation_attempts").update(mapped).eq("id", attemptId);
    if (expectedStatus) query = query.eq("status", expectedStatus);
    const { data, error } = await query.select("id");
    if (error) throw new Error(error.message);
    return (data?.length ?? 0) > 0;
  }

  async findMerchantUser(identifier: string, { byEmail = true } = {}): Promise<MerchantUserRow | null> {
    if (!this.client) return null;
    for (const column of byEmail ? (["id", "email"] as const) : (["id"] as const)) {
      const { data, error } = await this.client
        .from("app_users")
        .select(MERCHANT_USER_COLUMNS)
        .eq(column, identifier)
        .maybeSingle();
      if (error) console.error(`Error querying app_users by ${column}:`, error);
      if (data) return data as MerchantUserRow;
    }
    return null;
  }

  async countFollowers(merchantId: string): Promise<number> {
    if (!this.client) return 0;
    const { count } = await this.client
      .from("merchant_followers")
      .select("id", { count: "exact", head: true })
      .eq("merchant_id", merchantId);
    return count || 0;
  }

  async getMerchantPublicProfile(merchantIdentifier: string): Promise<PublicStore | null> {
    const user = await this.findMerchantUser(merchantIdentifier, { byEmail: false });
    if (!user || user.role === "customer") return null;
    const [followers, products] = await Promise.all([this.countFollowers(user.id), this.getAllProducts()]);
    return toPublicStore(user, products, followers);
  }

  async getOwnMerchantProfile(userId: string): Promise<(PublicStore & { email: string | null }) | null> {
    const user = await this.findMerchantUser(userId);
    if (!user) return null;
    return { ...toPublicStore(user, [], await this.countFollowers(user.id)), email: user.email };
  }

  async updateMerchantProfile(
    merchantId: string,
    data: {
      businessName?: string;
      bio?: string;
      whatsappNumber?: string;
      location?: string;
      name?: string;
      email?: string;
    }
  ) {
    if (!this.client) return { success: true };
    const updates: Record<string, unknown> = {};
    if (data.businessName !== undefined) updates.business_name = data.businessName;
    if (data.bio !== undefined) updates.bio = data.bio;
    if (data.whatsappNumber !== undefined) updates.whatsapp_number = data.whatsappNumber;
    if (data.location !== undefined) updates.location = data.location;
    if (data.name !== undefined) updates.name = data.name;
    if (data.email !== undefined) updates.email = data.email;
    updates.updated_at = new Date().toISOString();

    const targetUserId =
      merchantId === "demo-merchant-001" || !merchantId ? "demo-merchant-001" : merchantId;

    // Only update email if it doesn't conflict with another user
    if (data.email) {
      const { data: existingUserWithEmail } = await this.client
        .from("app_users")
        .select("id")
        .eq("email", data.email)
        .maybeSingle();

      if (!existingUserWithEmail || existingUserWithEmail.id === targetUserId) {
        updates.email = data.email;
      }
    }

    // Update target user
    const { error: targetErr } = await this.client
      .from("app_users")
      .update(updates)
      .eq("id", targetUserId);

    if (targetErr) {
      console.error(`Error updating ${targetUserId}:`, targetErr);
    }

    // Safely sync business profile fields (excluding email) across demo aliases
    const profileSyncUpdates = { ...updates };
    delete profileSyncUpdates.email;

    if (targetUserId === "user-merchant") {
      await this.client
        .from("app_users")
        .update(profileSyncUpdates)
        .eq("id", "demo-merchant-001");
    } else if (targetUserId === "demo-merchant-001") {
      await this.client
        .from("app_users")
        .update(profileSyncUpdates)
        .eq("id", "user-merchant");
    }

    return { success: !targetErr };
  }

  async getIsFollowing(merchantId: string, customerId: string): Promise<boolean> {
    if (!this.client || !customerId) return false;
    const { data } = await this.client
      .from("merchant_followers")
      .select("id")
      .eq("merchant_id", merchantId)
      .eq("customer_id", customerId)
      .maybeSingle();
    return !!data;
  }

  async followMerchant(merchantId: string, customerId: string): Promise<{ success: boolean; followerCount?: number }> {
    if (!this.client) return { success: true };
    await this.client
      .from("merchant_followers")
      .upsert({ merchant_id: merchantId, customer_id: customerId }, { onConflict: "merchant_id,customer_id" });

    return { success: true, followerCount: await this.countFollowers(merchantId) };
  }

  async unfollowMerchant(merchantId: string, customerId: string): Promise<{ success: boolean; followerCount?: number }> {
    if (!this.client) return { success: true };
    await this.client
      .from("merchant_followers")
      .delete()
      .eq("merchant_id", merchantId)
      .eq("customer_id", customerId);

    return { success: true, followerCount: await this.countFollowers(merchantId) };
  }

  // --- Customer Wishlist ---
  async getCustomerWishlist(customerId: string): Promise<string[]> {
    if (!this.client || !customerId) return [];
    try {
      const { data } = await this.client
        .from("wishlists")
        .select("product_id")
        .eq("customer_id", customerId);
      return (data || []).map((row) => row.product_id);
    } catch {
      return [];
    }
  }

  async toggleWishlist(customerId: string, productId: string): Promise<{ inWishlist: boolean }> {
    if (!this.client) return { inWishlist: true };
    const { data } = await this.client
      .from("wishlists")
      .select("id")
      .eq("customer_id", customerId)
      .eq("product_id", productId)
      .maybeSingle();

    if (data) {
      await this.client.from("wishlists").delete().eq("id", data.id);
      return { inWishlist: false };
    } else {
      await this.client.from("wishlists").insert({ customer_id: customerId, product_id: productId });
      return { inWishlist: true };
    }
  }

  // --- Platform System Settings (Stored in DB) ---
  async getSystemSettings(): Promise<SystemSettings> {
    const fallback: SystemSettings = {
      id: "default",
      meshyApiKey: process.env.MESHY_API_KEY || "",
      meshyApiBaseUrl: process.env.MESHY_API_BASE_URL || "https://api.meshy.ai",
      meshyModel: process.env.MESHY_MODEL || "meshy-7.1",
      meshyGeometryResolution: process.env.MESHY_GEOMETRY_RESOLUTION || "standard",
      meshyTextureResolution: process.env.MESHY_TEXTURE_RESOLUTION || "2k",
      meshyCreditsPerGeneration: Number(process.env.MESHY_CREDITS_PER_GENERATION || "20"),
      usdToBdtRate: Number(process.env.USD_TO_BDT_RATE || "122.50"),
      costPerCreditUsd: Number(process.env.COST_PER_CREDIT_USD || "0.05"),
    };

    if (!this.client) return fallback;

    try {
      const { data, error } = await this.client
        .from("system_settings")
        .select("*")
        .eq("id", "default")
        .maybeSingle();

      if (error || !data) return fallback;

      return {
        id: data.id,
        meshyApiKey: data.meshy_api_key || fallback.meshyApiKey,
        meshyApiBaseUrl: data.meshy_api_base_url || fallback.meshyApiBaseUrl,
        meshyModel: data.meshy_model || fallback.meshyModel,
        meshyGeometryResolution: data.meshy_geometry_resolution || fallback.meshyGeometryResolution,
        meshyTextureResolution: data.meshy_texture_resolution || fallback.meshyTextureResolution,
        meshyCreditsPerGeneration: Number(data.meshy_credits_per_generation || 20),
        usdToBdtRate: Number(data.usd_to_bdt_rate || 122.50),
        costPerCreditUsd: Number(data.cost_per_credit_usd || 0.05),
        updatedAt: data.updated_at,
      };
    } catch (err) {
      console.error("Error reading system settings from DB:", err);
      return fallback;
    }
  }

  async updateSystemSettings(
    updates: Partial<SystemSettings>
  ): Promise<{ success: boolean; data?: SystemSettings }> {
    const dbPayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (updates.meshyApiKey !== undefined) dbPayload.meshy_api_key = updates.meshyApiKey;
    if (updates.meshyApiBaseUrl !== undefined) dbPayload.meshy_api_base_url = updates.meshyApiBaseUrl;
    if (updates.meshyModel !== undefined) dbPayload.meshy_model = updates.meshyModel;
    if (updates.meshyGeometryResolution !== undefined)
      dbPayload.meshy_geometry_resolution = updates.meshyGeometryResolution;
    if (updates.meshyTextureResolution !== undefined)
      dbPayload.meshy_texture_resolution = updates.meshyTextureResolution;
    if (updates.meshyCreditsPerGeneration !== undefined)
      dbPayload.meshy_credits_per_generation = updates.meshyCreditsPerGeneration;
    if (updates.usdToBdtRate !== undefined) dbPayload.usd_to_bdt_rate = updates.usdToBdtRate;
    if (updates.costPerCreditUsd !== undefined) dbPayload.cost_per_credit_usd = updates.costPerCreditUsd;

    if (!this.client) return { success: true };

    try {
      const { error } = await this.client
        .from("system_settings")
        .upsert({ id: "default", ...dbPayload }, { onConflict: "id" });

      if (error) {
        console.error("Failed to update system settings in DB:", error);
        return { success: false };
      }

      const fresh = await this.getSystemSettings();
      return { success: true, data: fresh };
    } catch (err) {
      console.error("Error updating system settings:", err);
      return { success: false };
    }
  }
}

export interface SystemSettings {
  id: string;
  meshyApiKey: string;
  meshyApiBaseUrl: string;
  meshyModel: string;
  meshyGeometryResolution: string;
  meshyTextureResolution: string;
  meshyCreditsPerGeneration: number;
  usdToBdtRate: number;
  costPerCreditUsd: number;
  updatedAt?: string;
}

export const supabaseDb = new SupabaseDbService();


