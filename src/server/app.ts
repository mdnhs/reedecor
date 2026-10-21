import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { inMemoryStore, StoredProduct } from "./demo-store";
import { meshyClient } from "@/lib/meshy/client";
import { storageService } from "@/lib/storage/supabase-storage";
import { DEMO_MERCHANT } from "@/lib/auth/auth";

export const app = new Hono().basePath("/api");

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------
const createProductSchema = z.object({
  name: z.string().min(2, "Product name must be at least 2 characters").max(100),
  category: z.enum([
    "Chair",
    "Sofa",
    "Table",
    "Bed",
    "Cabinet",
    "Home Decor",
    "Other",
  ]),
  description: z.string().max(1000).optional(),
  widthMm: z.number().positive("Width must be positive"),
  depthMm: z.number().positive("Depth must be positive"),
  heightMm: z.number().positive("Height must be positive"),
  images: z
    .array(
      z.object({
        viewType: z.enum(["front", "back", "left", "right"]),
        publicUrl: z.string().url(),
        fileName: z.string(),
        mimeType: z.string(),
        fileSizeBytes: z.number().nonnegative(),
        storagePath: z.string().optional(),
      })
    )
    .refine((imgs) => imgs.length === 4, {
      message: "Exactly four image views (front, back, left, right) are required",
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
    ),
});

// ---------------------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------------------

// 1. List Products
app.get("/products", async (c) => {
  const products = inMemoryStore.getAll();
  return c.json({
    success: true,
    data: products,
  });
});

// 2. Get Product By ID
app.get("/products/:id", async (c) => {
  const id = c.req.param("id");
  const product = inMemoryStore.getById(id);
  if (!product) {
    return c.json({ success: false, error: "Product not found" }, 404);
  }
  return c.json({ success: true, data: product });
});

// 3. Create Product
app.post("/products", zValidator("json", createProductSchema), async (c) => {
  const body = c.req.valid("json");
  const id = `prod-${Date.now()}`;

  const newProduct: StoredProduct = {
    id,
    merchantId: DEMO_MERCHANT.id,
    name: body.name,
    category: body.category,
    description: body.description || null,
    widthMm: Math.round(body.widthMm),
    depthMm: Math.round(body.depthMm),
    heightMm: Math.round(body.heightMm),
    status: "draft",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    images: body.images.map((img, idx) => ({
      id: `img-${id}-${idx}`,
      viewType: img.viewType,
      publicUrl: img.publicUrl,
      storagePath: img.storagePath || `products/${id}/${img.viewType}.jpg`,
      fileName: img.fileName,
      mimeType: img.mimeType,
      fileSizeBytes: img.fileSizeBytes,
    })),
    generationAttempts: [],
  };

  inMemoryStore.add(newProduct);

  return c.json({ success: true, data: newProduct }, 201);
});

// 4. Delete Product
app.delete("/products/:id", async (c) => {
  const id = c.req.param("id");
  const product = inMemoryStore.getById(id);
  if (!product) {
    return c.json({ success: false, error: "Product not found" }, 404);
  }

  // Delete assets from storage
  await storageService.deleteProductAssets(id);
  inMemoryStore.delete(id);

  return c.json({ success: true, message: "Product deleted successfully" });
});

// 5. Start Generation (Meshy AI Multi-Image)
app.post("/products/:id/generate", async (c) => {
  const id = c.req.param("id");
  const product = inMemoryStore.getById(id);
  if (!product) {
    return c.json({ success: false, error: "Product not found" }, 404);
  }

  if (product.images.length !== 4) {
    return c.json(
      { success: false, error: "Product must have all 4 angle images to generate 3D model" },
      400
    );
  }

  // Sort images in primary order: Front, Back, Left, Right
  const viewOrder = ["front", "back", "left", "right"];
  const orderedImages = [...product.images].sort(
    (a, b) => viewOrder.indexOf(a.viewType) - viewOrder.indexOf(b.viewType)
  );
  const imageUrls = orderedImages.map((img) => img.publicUrl);

  const attemptId = `gen-${Date.now()}`;
  const creditEstimate = Number(process.env.MESHY_CREDITS_PER_GENERATION || "20");

  try {
    const { taskId } = await meshyClient.createMultiImageTask({
      imageUrls,
      shouldTexture: true,
      textureResolution: "2k",
      enablePbr: true,
      modelType: "standard",
    });

    const newAttempt = {
      id: attemptId,
      provider: "meshy",
      providerTaskId: taskId,
      status: "processing" as const,
      modelUrl: null,
      creditCostEstimate: creditEstimate,
      errorCode: null,
      errorMessage: null,
      createdAt: new Date().toISOString(),
      completedAt: null,
    };

    inMemoryStore.update(id, (p) => ({
      ...p,
      status: "processing",
      updatedAt: new Date().toISOString(),
      generationAttempts: [newAttempt, ...p.generationAttempts],
    }));

    return c.json({
      success: true,
      data: {
        attemptId,
        providerTaskId: taskId,
        status: "processing",
      },
    });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Failed to initiate generation";
    const failedAttempt = {
      id: attemptId,
      provider: "meshy",
      providerTaskId: null,
      status: "failed" as const,
      modelUrl: null,
      creditCostEstimate: 0,
      errorCode: "GENERATION_INIT_FAILED",
      errorMessage,
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    };

    inMemoryStore.update(id, (p) => ({
      ...p,
      status: "failed",
      updatedAt: new Date().toISOString(),
      generationAttempts: [failedAttempt, ...p.generationAttempts],
    }));

    return c.json({ success: false, error: errorMessage }, 500);
  }
});

// 6. Check Generation Status
app.get("/products/:id/status", async (c) => {
  const id = c.req.param("id");
  const product = inMemoryStore.getById(id);
  if (!product) {
    return c.json({ success: false, error: "Product not found" }, 404);
  }

  const latestAttempt = product.generationAttempts[0];
  if (!latestAttempt) {
    return c.json({
      success: true,
      data: { status: product.status, progress: 0 },
    });
  }

  // If already terminal state, return directly
  if (latestAttempt.status === "completed" || latestAttempt.status === "failed") {
    return c.json({
      success: true,
      data: {
        status: latestAttempt.status,
        progress: latestAttempt.status === "completed" ? 100 : 0,
        modelUrl: latestAttempt.modelUrl,
        errorMessage: latestAttempt.errorMessage,
      },
    });
  }

  // Poll provider
  if (latestAttempt.providerTaskId) {
    try {
      const task = await meshyClient.getTaskStatus(latestAttempt.providerTaskId);

      if (task.status === "SUCCEEDED" && task.model_urls?.glb) {
        const modelUrl = task.model_urls.glb;
        inMemoryStore.update(id, (p) => {
          const updatedAttempts = [...p.generationAttempts];
          updatedAttempts[0] = {
            ...updatedAttempts[0],
            status: "completed",
            modelUrl,
            completedAt: new Date().toISOString(),
          };
          return {
            ...p,
            status: "completed",
            updatedAt: new Date().toISOString(),
            generationAttempts: updatedAttempts,
          };
        });

        return c.json({
          success: true,
          data: {
            status: "completed",
            progress: 100,
            modelUrl,
          },
        });
      } else if (task.status === "FAILED") {
        const errorMsg = task.task_error?.message || "Meshy generation failed";
        inMemoryStore.update(id, (p) => {
          const updatedAttempts = [...p.generationAttempts];
          updatedAttempts[0] = {
            ...updatedAttempts[0],
            status: "failed",
            errorMessage: errorMsg,
            errorCode: "PROVIDER_FAILED",
            completedAt: new Date().toISOString(),
          };
          return {
            ...p,
            status: "failed",
            updatedAt: new Date().toISOString(),
            generationAttempts: updatedAttempts,
          };
        });

        return c.json({
          success: true,
          data: {
            status: "failed",
            progress: 0,
            errorMessage: errorMsg,
          },
        });
      } else {
        return c.json({
          success: true,
          data: {
            status: "processing",
            progress: task.progress || 35,
          },
        });
      }
    } catch (err: unknown) {
      return c.json({
        success: true,
        data: {
          status: "processing",
          progress: 50,
          warning: err instanceof Error ? err.message : "Polling transient issue",
        },
      });
    }
  }

  return c.json({
    success: true,
    data: { status: "processing", progress: 20 },
  });
});

// 7. Retry Generation
app.post("/products/:id/retry", async (c) => {
  const id = c.req.param("id");
  const product = inMemoryStore.getById(id);
  if (!product) {
    return c.json({ success: false, error: "Product not found" }, 404);
  }

  const viewOrder = ["front", "back", "left", "right"];
  const orderedImages = [...product.images].sort(
    (a, b) => viewOrder.indexOf(a.viewType) - viewOrder.indexOf(b.viewType)
  );
  const imageUrls = orderedImages.map((img) => img.publicUrl);

  const attemptId = `gen-retry-${Date.now()}`;
  const creditEstimate = Number(process.env.MESHY_CREDITS_PER_GENERATION || "20");

  try {
    const { taskId } = await meshyClient.createMultiImageTask({
      imageUrls,
      shouldTexture: true,
      textureResolution: "2k",
      enablePbr: true,
      modelType: "standard",
    });

    const newAttempt = {
      id: attemptId,
      provider: "meshy",
      providerTaskId: taskId,
      status: "processing" as const,
      modelUrl: null,
      creditCostEstimate: creditEstimate,
      errorCode: null,
      errorMessage: null,
      createdAt: new Date().toISOString(),
      completedAt: null,
    };

    inMemoryStore.update(id, (p) => ({
      ...p,
      status: "processing",
      updatedAt: new Date().toISOString(),
      generationAttempts: [newAttempt, ...p.generationAttempts],
    }));

    return c.json({
      success: true,
      data: {
        attemptId,
        providerTaskId: taskId,
        status: "processing",
      },
    });
  } catch (err: unknown) {
    return c.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Failed to retry generation",
      },
      500
    );
  }
});

// 8. Credits & Usage Analytics
app.get("/credits/usage", async (c) => {
  const products = inMemoryStore.getAll();
  const allAttempts = products.flatMap((p) => p.generationAttempts);

  const totalAttempts = allAttempts.length;
  const completedAttempts = allAttempts.filter((a) => a.status === "completed").length;
  const failedAttempts = allAttempts.filter((a) => a.status === "failed").length;
  const processingAttempts = allAttempts.filter((a) => a.status === "processing").length;

  const creditsPerGen = Number(process.env.MESHY_CREDITS_PER_GENERATION || "20");
  const costPerCreditUSD = Number(process.env.COST_PER_CREDIT_USD || "0.05");
  const usdToBdtRate = Number(process.env.USD_TO_BDT_RATE || "122.5");

  const totalCreditsUsed = completedAttempts * creditsPerGen;
  const totalCostUSD = totalCreditsUsed * costPerCreditUSD;
  const totalCostBDT = totalCostUSD * usdToBdtRate;

  return c.json({
    success: true,
    data: {
      totalAttempts,
      completedAttempts,
      failedAttempts,
      processingAttempts,
      totalCreditsUsed,
      totalCostUSD,
      totalCostBDT,
      usdToBdtRate,
      creditsPerGen,
      costPerCreditUSD,
      history: allAttempts.slice(0, 20),
    },
  });
});
