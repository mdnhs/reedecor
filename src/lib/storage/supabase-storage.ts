import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { resolveSupabaseConfig } from "@/lib/supabase/config";
import { StorageProvider, StorageUploadResult } from "./types";
import { assetObjectPath } from "../assets/paths";

export const BUCKET_NAME = process.env.SUPABASE_STORAGE_BUCKET || "furniture-3d-studio";

let serverClient: SupabaseClient | null = null;

export function getSupabaseServerClient(): SupabaseClient | null {
  const config = resolveSupabaseConfig();
  if (!config) return null;
  if (!serverClient) {
    serverClient = createClient(config.url, config.key, {
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
    viewType: "front" | "back" | "left" | "right" | "single"
  ): Promise<StorageUploadResult> {
    const ext = fileName.split(".").pop()?.toLowerCase() || "jpg";
    const path = `products/${productId}/${viewType}-${Date.now()}.${ext}`;

    const contentType =
      ext === "png"
        ? "image/png"
        : ext === "webp"
        ? "image/webp"
        : "image/jpeg";

    if (!this.client) {
      const bytes = Buffer.isBuffer(file) ? file : Buffer.from(await (file as Blob).arrayBuffer());
      return {
        path,
        publicUrl: `data:${contentType};base64,${bytes.toString("base64")}`,
        sizeBytes: bytes.length,
        mimeType: contentType,
      };
    }

    await this.ensureBucket();

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

  async uploadProductThumbnail(
    file: Buffer,
    mimeType: string,
    productId: string
  ): Promise<StorageUploadResult> {
    const ext = mimeType === "image/jpeg" ? "jpg" : mimeType === "image/webp" ? "webp" : "png";
    const path = `products/${productId}/thumbnail-${Date.now()}.${ext}`;

    if (!this.client) {
      return {
        path,
        publicUrl: `data:${mimeType};base64,${file.toString("base64")}`,
        sizeBytes: file.length,
        mimeType,
      };
    }

    await this.ensureBucket();

    const { error } = await this.client.storage.from(BUCKET_NAME).upload(path, file, {
      contentType: mimeType,
      upsert: true,
    });

    if (error) {
      throw new Error(`Failed to upload thumbnail: ${error.message}`);
    }

    const {
      data: { publicUrl },
    } = this.client.storage.from(BUCKET_NAME).getPublicUrl(path);

    return { path, publicUrl, sizeBytes: file.length, mimeType };
  }

  async uploadAssetFile(
    file: Buffer,
    kind: "glb" | "preview",
    assetId: string,
    version: number
  ): Promise<StorageUploadResult> {
    if (!this.client) {
      throw new Error("Supabase storage is not configured; room assets need real storage.");
    }

    const path = assetObjectPath(assetId, version, kind, crypto.randomUUID());
    const mimeType = kind === "glb" ? "model/gltf-binary" : "image/png";

    await this.ensureBucket();

    const { error } = await this.client.storage.from(BUCKET_NAME).upload(path, file, {
      contentType: mimeType,
      upsert: true,
    });

    if (error) {
      throw new Error(`Failed to upload asset ${kind}: ${error.message}`);
    }

    const {
      data: { publicUrl },
    } = this.client.storage.from(BUCKET_NAME).getPublicUrl(path);

    return { path, publicUrl, sizeBytes: file.length, mimeType };
  }

  async removeAssetFiles(paths: string[]): Promise<void> {
    if (!this.client || paths.length === 0) return;
    await this.client.storage.from(BUCKET_NAME).remove(paths);
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
