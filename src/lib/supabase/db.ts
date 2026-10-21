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
}

export const supabaseDb = new SupabaseDbService();
