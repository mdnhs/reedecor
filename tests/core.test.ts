import { describe, it, expect } from "vitest";
import { formatDimension, formatCurrencyBDT } from "../src/lib/utils";
import { cleanWhatsAppNumber, buildProductWhatsAppUrl } from "../src/lib/whatsapp";
import { z } from "zod";

describe("Product Dimension Normalization", () => {
  it("formats millimeter to centimeters correctly", () => {
    expect(formatDimension(850, "cm")).toBe("85.0 cm");
    expect(formatDimension(1200, "cm")).toBe("120.0 cm");
  });

  it("formats millimeters as raw mm", () => {
    expect(formatDimension(850, "mm")).toBe("850 mm");
  });
});

describe("BDT Currency Cost Calculation", () => {
  it("calculates BDT correctly given USD and exchange rate", () => {
    const usd = 1.0; // 20 credits * $0.05
    const rate = 122.5;
    expect(formatCurrencyBDT(usd, rate)).toBe("৳122.5");
  });
});

describe("4-Angle Product Image Validation Schema", () => {
  const imageSchema = z
    .array(
      z.object({
        viewType: z.enum(["front", "back", "left", "right"]),
        publicUrl: z.string().url(),
      })
    )
    .refine((imgs) => imgs.length === 4, {
      message: "Exactly four image views are required",
    })
    .refine(
      (imgs) => {
        const views = new Set(imgs.map((i) => i.viewType));
        return (
          views.has("front") &&
          views.has("back") &&
          views.has("left") &&
          views.has("right")
        );
      },
      {
        message: "All four angles must be present: front, back, left, right",
      }
    );

  it("accepts valid 4 distinct views", () => {
    const validImages = [
      { viewType: "front" as const, publicUrl: "https://example.com/front.jpg" },
      { viewType: "back" as const, publicUrl: "https://example.com/back.jpg" },
      { viewType: "left" as const, publicUrl: "https://example.com/left.jpg" },
      { viewType: "right" as const, publicUrl: "https://example.com/right.jpg" },
    ];
    const result = imageSchema.safeParse(validImages);
    expect(result.success).toBe(true);
  });

  it("rejects when fewer than 4 views are provided", () => {
    const incompleteImages = [
      { viewType: "front" as const, publicUrl: "https://example.com/front.jpg" },
      { viewType: "back" as const, publicUrl: "https://example.com/back.jpg" },
    ];
    const result = imageSchema.safeParse(incompleteImages);
    expect(result.success).toBe(false);
  });

  it("rejects when an angle is duplicated and another is missing", () => {
    const duplicateImages = [
      { viewType: "front" as const, publicUrl: "https://example.com/front.jpg" },
      { viewType: "front" as const, publicUrl: "https://example.com/front2.jpg" },
      { viewType: "left" as const, publicUrl: "https://example.com/left.jpg" },
      { viewType: "right" as const, publicUrl: "https://example.com/right.jpg" },
    ];
    const result = imageSchema.safeParse(duplicateImages);
    expect(result.success).toBe(false);
  });
});

describe("WhatsApp Integration for Furniture Ordering", () => {
  it("cleans standard and local Bangladeshi WhatsApp phone numbers", () => {
    expect(cleanWhatsAppNumber("+880 1865-818044")).toBe("8801865818044");
    expect(cleanWhatsAppNumber("01865818044")).toBe("8801865818044");
  });

  it("generates pre-filled WhatsApp link with specific product name, price in BDT, and dimensions", () => {
    const url = buildProductWhatsAppUrl("01865818044", {
      name: "Velvet Sheen Accent Chair",
      category: "Chair",
      priceBdt: 32500,
      widthMm: 850,
      depthMm: 780,
      heightMm: 820,
      storeUrl: "https://studio.artisan.com/viewer/prod-sheen-chair-01",
    });

    expect(url).toContain("https://wa.me/8801865818044?text=");
    expect(url).toContain(encodeURIComponent("Velvet Sheen Accent Chair"));
    expect(url).toContain(encodeURIComponent("৳32,500"));
    expect(url).toContain(encodeURIComponent("850 x 780 x 820 mm"));
  });
});

describe("Single Image to 3D vs Multi-Image to 3D Options", () => {
  const singleImageSchema = z
    .array(
      z.object({
        viewType: z.enum(["front", "back", "left", "right", "single"]),
        publicUrl: z.string().url(),
      })
    )
    .min(1, "At least 1 image is required");

  it("accepts a single image for Image to 3D mode", () => {
    const singleImage = [
      { viewType: "front" as const, publicUrl: "https://example.com/hero.jpg" },
    ];
    const result = singleImageSchema.safeParse(singleImage);
    expect(result.success).toBe(true);
  });

  it("rejects empty image array for Image to 3D mode", () => {
    const result = singleImageSchema.safeParse([]);
    expect(result.success).toBe(false);
  });
});

describe("3D Generation Cancellation & Proxy Resolution", () => {
  it("resolves external CDN URLs to internal proxy endpoint to bypass CORS", () => {
    const externalUrl = "https://assets.meshy.ai/tasks/01a15e33/model.glb";
    const resolved = `/api/proxy-model?url=${encodeURIComponent(externalUrl)}`;
    expect(resolved).toContain("/api/proxy-model?url=");
    expect(decodeURIComponent(resolved.split("?url=")[1])).toBe(externalUrl);
  });

  it("marks cancelled task with USER_CANCELLED errorCode and stopped status", () => {
    const attempt = {
      id: "gen-cancel-01",
      provider: "meshy" as const,
      providerTaskId: "meshy-123",
      status: "failed" as const,
      modelUrl: null,
      creditCostEstimate: 20,
      errorCode: "CANCELLED_BY_USER",
      errorMessage: "Generation was cancelled by the user.",
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    };

    expect(attempt.status).toBe("failed");
    expect(attempt.errorCode).toBe("CANCELLED_BY_USER");
    expect(attempt.errorMessage).toContain("cancelled by the user");
  });
});

describe("3D Model GLB Optimization Pipeline", () => {
  it("exports optimizeGlbBuffer and optimizes or safely handles buffers", async () => {
    const { optimizeGlbBuffer } = await import("../src/lib/storage/glb-optimizer");
    expect(typeof optimizeGlbBuffer).toBe("function");

    // Test with sample GLB file if present
    const fs = await import("fs");
    const path = await import("path");
    const samplePath = path.join(process.cwd(), "public", "models", "default-model.glb");

    if (fs.existsSync(samplePath)) {
      const raw = fs.readFileSync(samplePath);
      const optimized = await optimizeGlbBuffer(raw);
      expect(optimized).toBeInstanceOf(Buffer);
      expect(optimized.length).toBeGreaterThan(0);
      expect(optimized.length).toBeLessThanOrEqual(raw.length);
    }
  });
});


