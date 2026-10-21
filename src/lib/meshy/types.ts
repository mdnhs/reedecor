export type MeshyTaskStatus =
  | "PENDING"
  | "IN_PROGRESS"
  | "SUCCEEDED"
  | "FAILED"
  | "EXPIRED";

export interface MeshyMultiImageRequest {
  image_urls: string[]; // 1 to 4 image URLs or data URIs
  enable_pbr?: boolean;
  should_texture?: boolean;
  texture_resolution?: "2k" | "4k" | "8k";
  model_type?: "standard" | "high_poly";
  target_polycount?: number;
  ai_model?: string;
}

export interface MeshyTaskResponse {
  id: string;
  status: MeshyTaskStatus;
  progress: number;
  created_at: number;
  expires_at?: number;
  task_error?: {
    message: string;
  };
  model_urls?: {
    glb?: string;
    fbx?: string;
    obj?: string;
    usdz?: string;
  };
  texture_urls?: Array<{
    base_color?: string;
    normal?: string;
    roughness?: string;
    metallic?: string;
  }>;
  thumbnail_url?: string;
}
