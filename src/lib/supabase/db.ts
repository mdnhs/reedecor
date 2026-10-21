import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { StoredProduct, initialProducts } from "@/server/demo-store";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://aafouqxsgibfqjcxozii.supabase.co";
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "";

let supabaseClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (!supabaseKey) return null;
  if (!supabaseClient) {
    supabaseClient = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false },
    });
  }
  return supabaseClient;
}

export class SupabaseDbService {
  private client: SupabaseClient | null;

  constructor() {
    this.client = getSupabaseClient();
  }

  async getAllProducts(): Promise<StoredProduct[]> {
    if (!this.client) return [];

    try {
      const { data: productsData, error: prodErr } = await this.client
        .from("products")
        .select("*")
        .order("created_at", { ascending: false });

      if (prodErr || !productsData || productsData.length === 0) {
        // If empty, seed initial demo products into Supabase
        await this.seedInitialProducts();
        return initialProducts;
      }

      // Fetch related images and attempts
      const { data: imagesData } = await this.client.from("product_images").select("*");
      const { data: attemptsData } = await this.client
        .from("generation_attempts")
        .select("*")
        .order("created_at", { ascending: false });

      return productsData.map((p) => ({
        id: p.id,
        merchantId: p.merchant_id,
        name: p.name,
        category: p.category,
        description: p.description,
        widthMm: p.width_mm,
        depthMm: p.depth_mm,
        heightMm: p.height_mm,
        priceBdt: Number(p.price_bdt || 18500),
        status: p.status,
        createdAt: p.created_at,
        updatedAt: p.updated_at,
        images: (imagesData || [])
          .filter((img) => img.product_id === p.id)
          .map((img) => ({
            id: img.id,
            viewType: img.view_type,
            publicUrl: img.public_url,
            storagePath: img.storage_path,
            fileName: img.file_name,
            mimeType: img.mime_type,
            fileSizeBytes: img.file_size_bytes,
          })),
        generationAttempts: (attemptsData || [])
          .filter((att) => att.product_id === p.id)
          .map((att) => ({
            id: att.id,
            provider: att.provider,
            providerTaskId: att.provider_task_id,
            status: att.status,
            modelUrl: att.model_url,
            creditCostEstimate: Number(att.credit_cost_estimate || 20),
            errorCode: att.error_code,
            errorMessage: att.error_message,
            createdAt: att.created_at,
            completedAt: att.completed_at,
          })),
      }));
    } catch (err) {
      console.error("Supabase getAllProducts error, falling back:", err);
      return [];
    }
  }

  async getProductById(id: string): Promise<StoredProduct | null> {
    if (!this.client) return null;

    try {
      const { data: p, error } = await this.client
        .from("products")
        .select("*")
        .eq("id", id)
        .single();

      if (error || !p) return null;

      const { data: imagesData } = await this.client
        .from("product_images")
        .select("*")
        .eq("product_id", id);

      const { data: attemptsData } = await this.client
        .from("generation_attempts")
        .select("*")
        .eq("product_id", id)
        .order("created_at", { ascending: false });

      return {
        id: p.id,
        merchantId: p.merchant_id,
        name: p.name,
        category: p.category,
        description: p.description,
        widthMm: p.width_mm,
        depthMm: p.depth_mm,
        heightMm: p.height_mm,
        priceBdt: Number(p.price_bdt || 18500),
        status: p.status,
        createdAt: p.created_at,
        updatedAt: p.updated_at,
        images: (imagesData || []).map((img) => ({
          id: img.id,
          viewType: img.view_type,
          publicUrl: img.public_url,
          storagePath: img.storage_path,
          fileName: img.file_name,
          mimeType: img.mime_type,
          fileSizeBytes: img.file_size_bytes,
        })),
        generationAttempts: (attemptsData || []).map((att) => ({
          id: att.id,
          provider: att.provider,
          providerTaskId: att.provider_task_id,
          status: att.status,
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
    if (!this.client) return;

    await this.client.from("products").insert({
      id: product.id,
      merchant_id: product.merchantId,
      name: product.name,
      category: product.category,
      description: product.description,
      width_mm: product.widthMm,
      depth_mm: product.depthMm,
      height_mm: product.heightMm,
      price_bdt: product.priceBdt || 18500,
      status: product.status,
      created_at: product.createdAt,
      updated_at: product.updatedAt,
    });

    if (product.images.length > 0) {
      await this.client.from("product_images").insert(
        product.images.map((img) => ({
          id: img.id,
          product_id: product.id,
          view_type: img.viewType,
          storage_path: img.storagePath,
          public_url: img.publicUrl,
          file_name: img.fileName,
          mime_type: img.mimeType,
          file_size_bytes: img.fileSizeBytes,
          created_at: new Date().toISOString(),
        }))
      );
    }
  }

  async deleteProduct(id: string): Promise<void> {
    if (!this.client) return;
    await this.client.from("products").delete().eq("id", id);
  }

  async updateProductStatus(id: string, status: StoredProduct["status"]): Promise<void> {
    if (!this.client) return;
    await this.client
      .from("products")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id);
  }

  async addGenerationAttempt(
    productId: string,
    attempt: StoredProduct["generationAttempts"][0]
  ): Promise<void> {
    if (!this.client) return;
    await this.client.from("generation_attempts").insert({
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
      completedAt: attempt.completedAt,
    });
  }

  async updateGenerationAttempt(
    attemptId: string,
    updates: Partial<StoredProduct["generationAttempts"][0]>
  ): Promise<void> {
    if (!this.client) return;
    const mapped: Record<string, unknown> = {};
    if (updates.status) mapped.status = updates.status;
    if (updates.modelUrl !== undefined) mapped.model_url = updates.modelUrl;
    if (updates.errorMessage !== undefined) mapped.error_message = updates.errorMessage;
    if (updates.errorCode !== undefined) mapped.error_code = updates.errorCode;
    if (updates.completedAt !== undefined) mapped.completed_at = updates.completedAt;
    mapped.updated_at = new Date().toISOString();

    await this.client.from("generation_attempts").update(mapped).eq("id", attemptId);
  }

  async seedInitialProducts(): Promise<void> {
    if (!this.client) return;
    for (const prod of initialProducts) {
      await this.createProduct(prod);
      for (const att of prod.generationAttempts) {
        await this.addGenerationAttempt(prod.id, att);
      }
    }
  }

  // --- Merchant Public Profile & Followers ---
  async getMerchantPublicProfile(merchantIdentifier: string) {
    if (!this.client) {
      return {
        id: "demo-merchant-001",
        name: "Artisan Woodworks Dhaka",
        businessName: "Artisan Woodworks Studio",
        bio: "Bespoke handcrafted Scandinavian & modern teak/oak furniture crafted in Dhaka. Custom dimensions available.",
        whatsappNumber: "01865818044",
        location: "Gulshan-2, Dhaka, Bangladesh",
        followerCount: 142,
        products: initialProducts,
      };
    }

    try {
      // Find merchant user by id or email or fallback to demo
      const { data: user } = await this.client
        .from("app_users")
        .select("id, name, email, role, business_name, bio, whatsapp_number, location, avatar_url")
        .or(`id.eq.${merchantIdentifier},email.eq.${merchantIdentifier}`)
        .maybeSingle();

      const merchantUser = user || {
        id: merchantIdentifier,
        name: "Artisan Living Studio",
        email: "merchant@artisanstudio.com",
        role: "merchant",
        business_name: "Artisan Living Dhaka",
        bio: "Luxury architectural handcrafted 3D custom furniture. Made to order with premium hardwoods.",
        whatsapp_number: "01865818044",
        location: "Gulshan-2, Dhaka",
        avatar_url: null,
      };

      // Count followers
      const { count } = await this.client
        .from("merchant_followers")
        .select("id", { count: "exact", head: true })
        .eq("merchant_id", merchantUser.id);

      // Get all products (or products for this merchant)
      const allProducts = await this.getAllProducts();
      const merchantProducts = allProducts.filter(
        (p) => p.merchantId === merchantUser.id || p.merchantId === "demo-merchant-001" || merchantUser.role === "saas_admin"
      );

      return {
        id: merchantUser.id,
        name: merchantUser.name || "Artisan Living Studio",
        businessName: merchantUser.business_name || "Artisan Living Dhaka",
        bio: merchantUser.bio || "Luxury architectural handcrafted 3D custom furniture. Made to order with premium hardwoods.",
        whatsappNumber: merchantUser.whatsapp_number || "01865818044",
        location: merchantUser.location || "Gulshan-2, Dhaka",
        avatarUrl: merchantUser.avatar_url || null,
        followerCount: (count || 0) + 128, // base community count
        products: merchantProducts.length > 0 ? merchantProducts : allProducts,
      };
    } catch (err) {
      console.error("Error fetching merchant public profile:", err);
      return null;
    }
  }

  async updateMerchantProfile(
    merchantId: string,
    data: { businessName?: string; bio?: string; whatsappNumber?: string; location?: string; name?: string }
  ) {
    if (!this.client) return { success: true };
    const updates: Record<string, unknown> = {};
    if (data.businessName !== undefined) updates.business_name = data.businessName;
    if (data.bio !== undefined) updates.bio = data.bio;
    if (data.whatsappNumber !== undefined) updates.whatsapp_number = data.whatsappNumber;
    if (data.location !== undefined) updates.location = data.location;
    if (data.name !== undefined) updates.name = data.name;

    const { error } = await this.client.from("app_users").update(updates).eq("id", merchantId);
    if (error) console.error("Error updating merchant profile:", error);
    return { success: !error };
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

    const { count } = await this.client
      .from("merchant_followers")
      .select("id", { count: "exact", head: true })
      .eq("merchant_id", merchantId);

    return { success: true, followerCount: (count || 0) + 128 };
  }

  async unfollowMerchant(merchantId: string, customerId: string): Promise<{ success: boolean; followerCount?: number }> {
    if (!this.client) return { success: true };
    await this.client
      .from("merchant_followers")
      .delete()
      .eq("merchant_id", merchantId)
      .eq("customer_id", customerId);

    const { count } = await this.client
      .from("merchant_followers")
      .select("id", { count: "exact", head: true })
      .eq("merchant_id", merchantId);

    return { success: true, followerCount: (count || 0) + 128 };
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
      meshyApiKey: process.env.MESHY_API_KEY || "your_meshy_api_key_here",
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


