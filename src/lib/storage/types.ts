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

  uploadModelFile(
    file: Blob | Buffer,
    fileName: string,
    productId: string
  ): Promise<StorageUploadResult>;

  getPublicUrl(path: string): string;

  deleteProductAssets(productId: string): Promise<void>;
}
