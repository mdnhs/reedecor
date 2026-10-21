import {
  MeshyMultiImageRequest,
  MeshySingleImageRequest,
  MeshyTaskResponse,
} from "./types";

const MESHY_BASE_URL = process.env.MESHY_API_BASE_URL || "https://api.meshy.ai";
const MESHY_API_KEY = process.env.MESHY_API_KEY;

export class MeshyClient {
  private apiKey: string | undefined;
  private baseUrl: string;

  constructor(apiKey?: string, baseUrl?: string) {
    this.apiKey = apiKey || MESHY_API_KEY;
    this.baseUrl = baseUrl || MESHY_BASE_URL;
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey !== "your_meshy_api_key_here");
  }

  updateConfig(apiKey?: string, baseUrl?: string) {
    if (apiKey !== undefined) this.apiKey = apiKey;
    if (baseUrl !== undefined) this.baseUrl = baseUrl;
  }

  async createMultiImageTask(params: {
    imageUrls: string[];
    shouldTexture?: boolean;
    textureResolution?: "2k" | "4k" | "8k";
    enablePbr?: boolean;
    modelType?: "standard" | "high_poly";
  }): Promise<{ taskId: string; isMock: boolean }> {
    if (!this.isConfigured()) {
      console.warn("Meshy API Key not configured. Using realistic simulated 3D task.");
      return {
        taskId: `mock-task-${Date.now()}`,
        isMock: true,
      };
    }

    const payload: MeshyMultiImageRequest = {
      image_urls: params.imageUrls,
      should_texture: params.shouldTexture ?? true,
      texture_resolution:
        params.textureResolution ||
        (process.env.MESHY_TEXTURE_RESOLUTION as "2k" | "4k" | "8k") ||
        "2k",
      enable_pbr: params.enablePbr ?? true,
      model_type: params.modelType || "standard",
    };

    const response = await fetch(`${this.baseUrl}/openapi/v1/multi-image-to-3d`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { message: errorText };
      }
      throw new Error(
        `Meshy API Error (${response.status}): ${
          errorData.message || errorData.task_error?.message || response.statusText
        }`
      );
    }

    const data = await response.json();
    return {
      taskId: data.result || data.id,
      isMock: false,
    };
  }

  async createImageTo3dTask(params: {
    imageUrl: string;
    shouldTexture?: boolean;
    textureResolution?: "2k" | "4k" | "8k";
    enablePbr?: boolean;
    modelType?: "standard" | "high_poly";
  }): Promise<{ taskId: string; isMock: boolean }> {
    if (!this.isConfigured()) {
      console.warn("Meshy API Key not configured. Using realistic simulated 3D task.");
      return {
        taskId: `mock-task-single-${Date.now()}`,
        isMock: true,
      };
    }

    const payload: MeshySingleImageRequest = {
      image_url: params.imageUrl,
      should_texture: params.shouldTexture ?? true,
      texture_resolution:
        params.textureResolution ||
        (process.env.MESHY_TEXTURE_RESOLUTION as "2k" | "4k" | "8k") ||
        "2k",
      enable_pbr: params.enablePbr ?? true,
      model_type: params.modelType || "standard",
    };

    const response = await fetch(`${this.baseUrl}/openapi/v1/image-to-3d`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { message: errorText };
      }
      throw new Error(
        `Meshy API Error (${response.status}): ${
          errorData.message || errorData.task_error?.message || response.statusText
        }`
      );
    }

    const data = await response.json();
    return {
      taskId: data.result || data.id,
      isMock: false,
    };
  }

  async getTaskStatus(
    taskId: string,
    mode: "image_to_3d" | "multi_image_to_3d" = "multi_image_to_3d"
  ): Promise<MeshyTaskResponse> {
    if (taskId.startsWith("mock-task-")) {
      // Simulate realistic generation progression
      const timestamp = parseInt(
        taskId.replace("mock-task-single-", "").replace("mock-task-", ""),
        10
      );
      const elapsedSeconds = (Date.now() - timestamp) / 1000;

      if (elapsedSeconds < 4) {
        return {
          id: taskId,
          status: "PENDING",
          progress: 15,
          created_at: timestamp,
        };
      } else if (elapsedSeconds < 10) {
        return {
          id: taskId,
          status: "IN_PROGRESS",
          progress: Math.min(90, Math.floor(20 + elapsedSeconds * 8)),
          created_at: timestamp,
        };
      } else {
        return {
          id: taskId,
          status: "SUCCEEDED",
          progress: 100,
          created_at: timestamp,
          model_urls: {
            glb: "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/SheenChair/glTF-Binary/SheenChair.glb",
          },
          thumbnail_url: "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=400&fit=crop",
        };
      }
    }

    // Try appropriate endpoint depending on mode, with fallback
    const endpointPath =
      mode === "image_to_3d"
        ? `${this.baseUrl}/openapi/v1/image-to-3d/${taskId}`
        : `${this.baseUrl}/openapi/v1/multi-image-to-3d/${taskId}`;

    let response = await fetch(endpointPath, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
    });

    if (!response.ok && mode === "image_to_3d") {
      // Fallback to multi-image path if single image path returned 404
      const fallbackUrl = `${this.baseUrl}/openapi/v1/multi-image-to-3d/${taskId}`;
      const altRes = await fetch(fallbackUrl, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
      });
      if (altRes.ok) response = altRes;
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch Meshy task status (${response.status}): ${errorText}`);
    }

    return (await response.json()) as MeshyTaskResponse;
  }
}

export const meshyClient = new MeshyClient();
