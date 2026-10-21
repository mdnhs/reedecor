import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { StorageProvider, StorageUploadResult } from "./types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://aafouqxsgibfqjcxozii.supabase.co";
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "";

export const BUCKET_NAME = process.env.SUPABASE_STORAGE_BUCKET || "furniture-3d-studio";

let serverClient: SupabaseClient | null = null;

export function getSupabaseServerClient(): SupabaseClient | null {
  if (!supabaseKey) {
    return null;
  }
  if (!serverClient) {
    serverClient = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false },
    });
  }
  return serverClient;
}

export class SupabaseStorageService implements StorageProvider {
  private client: SupabaseClient | null;

  constructor() {
    this.client = getSupabaseServerClient();
  }

  async ensureBucket(): Promise<boolean> {
    if (!this.client) return false;
    try {
      const { data: buckets } = await this.client.storage.listBuckets();
      const exists = buckets?.some((b) => b.name === BUCKET_NAME);
      if (!exists) {
        await this.client.storage.createBucket(BUCKET_NAME, {
          public: true,
          fileSizeLimit: 52428800, // 50MB
        });
      }
      return true;
    } catch {
      return false;
    }
  }

  async uploadProductImage(
    file: Blob | File | Buffer,
    fileName: string,
    productId: string,
    viewType: "front" | "back" | "left" | "right"
  ): Promise<StorageUploadResult> {
    const ext = fileName.split(".").pop()?.toLowerCase() || "jpg";
    const path = `products/${productId}/${viewType}-${Date.now()}.${ext}`;

    if (!this.client) {
      // Mock / fallback if no credentials set yet
      return {
        path,
        publicUrl: `https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800&auto=format&fit=crop`,
        sizeBytes: 1024 * 500,
        mimeType: `image/${ext === "jpg" ? "jpeg" : ext}`,
      };
    }

    await this.ensureBucket();

    const contentType =
      ext === "png"
        ? "image/png"
        : ext === "webp"
        ? "image/webp"
        : "image/jpeg";

    const { error } = await this.client.storage.from(BUCKET_NAME).upload(path, file, {
      contentType,
      upsert: true,
    });

    if (error) {
      throw new Error(`Failed to upload to Supabase Storage: ${error.message}`);
    }

    const {
      data: { publicUrl },
    } = this.client.storage.from(BUCKET_NAME).getPublicUrl(path);

    const sizeBytes = file instanceof Blob ? file.size : Buffer.isBuffer(file) ? file.length : 0;

    return {
      path,
      publicUrl,
      sizeBytes,
      mimeType: contentType,
    };
  }

  async uploadModelFile(
    file: Blob | Buffer,
    fileName: string,
    productId: string
  ): Promise<StorageUploadResult> {
    const path = `models/${productId}/${fileName || "model.glb"}`;

    if (!this.client) {
      return {
        path,
        publicUrl: "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/SheenChair/glTF-Binary/SheenChair.glb",
        sizeBytes: 1024 * 1024 * 4,
        mimeType: "model/gltf-binary",
      };
    }

    await this.ensureBucket();

    const { error } = await this.client.storage.from(BUCKET_NAME).upload(path, file, {
      contentType: "model/gltf-binary",
      upsert: true,
    });

    if (error) {
      throw new Error(`Failed to upload GLB model: ${error.message}`);
    }

    const {
      data: { publicUrl },
    } = this.client.storage.from(BUCKET_NAME).getPublicUrl(path);

    const sizeBytes = file instanceof Blob ? file.size : Buffer.isBuffer(file) ? file.length : 0;

    return {
      path,
      publicUrl,
      sizeBytes,
      mimeType: "model/gltf-binary",
    };
  }

  getPublicUrl(path: string): string {
    if (!this.client) {
      return path;
    }
    const {
      data: { publicUrl },
    } = this.client.storage.from(BUCKET_NAME).getPublicUrl(path);
    return publicUrl;
  }

  async deleteProductAssets(productId: string): Promise<void> {
    if (!this.client) return;

    try {
      const { data: images } = await this.client.storage
        .from(BUCKET_NAME)
        .list(`products/${productId}`);
      if (images && images.length > 0) {
        await this.client.storage
          .from(BUCKET_NAME)
          .remove(images.map((img) => `products/${productId}/${img.name}`));
      }

      const { data: models } = await this.client.storage
        .from(BUCKET_NAME)
        .list(`models/${productId}`);
      if (models && models.length > 0) {
        await this.client.storage
          .from(BUCKET_NAME)
          .remove(models.map((m) => `models/${productId}/${m.name}`));
      }
    } catch (err) {
      console.error("Error deleting product assets from storage:", err);
    }
  }
}

export const storageService = new SupabaseStorageService();
