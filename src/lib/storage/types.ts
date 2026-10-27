export interface StorageUploadResult {
  path: string;
  publicUrl: string;
  sizeBytes: number;
  mimeType: string;
}

export interface StorageProvider {
  uploadProductImage(
    file: Blob | File | Buffer,
    fileName: string,
    productId: string,
    viewType: "front" | "back" | "left" | "right"
  ): Promise<StorageUploadResult>;

  uploadProductThumbnail(
    file: Buffer,
    mimeType: string,
    productId: string
  ): Promise<StorageUploadResult>;

  uploadAssetFile(
    file: Buffer,
    kind: "glb" | "preview",
    assetId: string,
    version: number
  ): Promise<StorageUploadResult>;

  removeAssetFiles(paths: string[]): Promise<void>;

  uploadBase64Image?(
    dataUrl: string,
    targetPathPrefix: string
  ): Promise<StorageUploadResult>;

  isConfigured?(): boolean;

  uploadModelFile(
    file: Blob | Buffer,
    fileName: string,
    productId: string
  ): Promise<StorageUploadResult>;

  getPublicUrl(path: string): string;

  deleteProductAssets(productId: string): Promise<void>;
}
