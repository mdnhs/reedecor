import { Hono, Context } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { inMemoryStore, StoredProduct } from "./demo-store";
import { supabaseDb } from "@/lib/supabase/db";
import { meshyClient } from "@/lib/meshy/client";
import { storageService } from "@/lib/storage/supabase-storage";
import { DEMO_MERCHANT } from "@/lib/constants";
import { authService, AppUser, UserRole } from "@/lib/supabase/auth-service";

export const app = new Hono().basePath("/api");

// ---------------------------------------------------------------------------
// Auth Helper & Middlewares
// ---------------------------------------------------------------------------
async function getCurrentUser(c: Context): Promise<AppUser | null> {
  const cookieToken = getCookie(c, "app_session");
  const authHeader = c.req.header("Authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const token = cookieToken || bearerToken;

  if (token) {
    const user = await authService.validateSession(token);
    if (user) return user;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------
const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(["saas_admin", "merchant", "customer"]).default("customer"),
});

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

const switchDemoSchema = z.object({
  role: z.enum(["saas_admin", "merchant", "customer"]),
});

const createProductSchema = z
  .object({
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
    priceBdt: z.number().positive("Price must be positive").default(18500),
    generationMode: z
      .enum(["image_to_3d", "multi_image_to_3d"])
      .default("multi_image_to_3d"),
    images: z
      .array(
        z.object({
          viewType: z.enum(["front", "back", "left", "right", "single"]),
          publicUrl: z.string().url(),
          fileName: z.string(),
          mimeType: z.string(),
          fileSizeBytes: z.number().nonnegative(),
          storagePath: z.string().optional(),
        })
      )
      .min(1, "At least one product image is required"),
  })
  .superRefine((data, ctx) => {
    if (data.generationMode === "multi_image_to_3d") {
      if (data.images.length !== 4) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Multi-Image to 3D requires exactly 4 angles (front, back, left, right)",
          path: ["images"],
        });
        return;
      }
      const views = new Set(data.images.map((i) => i.viewType));
      if (!views.has("front") || !views.has("back") || !views.has("left") || !views.has("right")) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "All four angles must be present: front, back, left, right",
          path: ["images"],
        });
      }
    } else {
      if (data.images.length < 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Single Image to 3D requires at least 1 image",
          path: ["images"],
        });
      }
    }
  });

// ---------------------------------------------------------------------------
// Authentication & RBAC Routes
// ---------------------------------------------------------------------------

// 1. Get current logged in user
app.get("/auth/me", async (c) => {
  const user = await getCurrentUser(c);
  if (!user) {
    // If not authenticated, return default merchant context in demo mode
    return c.json({
      success: true,
      data: {
        id: DEMO_MERCHANT.id,
        email: DEMO_MERCHANT.email,
        name: DEMO_MERCHANT.name,
        role: "merchant" as UserRole,
        status: "active",
        isGuestFallback: true,
      },
    });
  }
  return c.json({
    success: true,
    data: user,
  });
});

// 2. Register
app.post("/auth/register", zValidator("json", registerSchema), async (c) => {
  const { name, email, password, role } = c.req.valid("json");
  try {
    const user = await authService.createUser(email, password, name, role as UserRole);
    const token = await authService.createSession(user.id);

    setCookie(c, "app_session", token, {
      path: "/",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 30 * 24 * 60 * 60,
      sameSite: "Lax",
    });

    return c.json({ success: true, data: user }, 201);
  } catch (err: unknown) {
    return c.json(
      { success: false, error: err instanceof Error ? err.message : "Registration failed" },
      400
    );
  }
});

// 3. Login
app.post("/auth/login", zValidator("json", loginSchema), async (c) => {
  const { email, password } = c.req.valid("json");
  try {
    const user = await authService.verifyCredentials(email, password);
    if (!user) {
      return c.json({ success: false, error: "Invalid email or password" }, 401);
    }

    const token = await authService.createSession(user.id);

    setCookie(c, "app_session", token, {
      path: "/",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 30 * 24 * 60 * 60,
      sameSite: "Lax",
    });

    return c.json({ success: true, data: user });
  } catch (err: unknown) {
    return c.json(
      { success: false, error: err instanceof Error ? err.message : "Login failed" },
      400
    );
  }
});

// 4. Logout
app.post("/auth/logout", async (c) => {
  const cookieToken = getCookie(c, "app_session");
  if (cookieToken) {
    await authService.deleteSession(cookieToken);
  }
  deleteCookie(c, "app_session", { path: "/" });
  return c.json({ success: true, message: "Logged out successfully" });
});

// 5. One-click Demo Role Switcher (For easy sandbox switching between saas_admin, merchant, customer)
app.post("/auth/switch-demo", zValidator("json", switchDemoSchema), async (c) => {
  const { role } = c.req.valid("json");
  await authService.ensureSeedUsers();

  const targetEmail =
    role === "saas_admin"
      ? "admin@artisanstudio.com"
      : role === "merchant"
      ? "merchant@artisanstudio.com"
      : "customer@artisanstudio.com";

  const password =
    role === "saas_admin" ? "admin123" : role === "merchant" ? "merchant123" : "customer123";

  const user = await authService.verifyCredentials(targetEmail, password);
  if (!user) {
    return c.json({ success: false, error: "Failed to switch role" }, 500);
  }

  const token = await authService.createSession(user.id);

  setCookie(c, "app_session", token, {
    path: "/",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 30 * 24 * 60 * 60,
    sameSite: "Lax",
  });

  return c.json({ success: true, data: user });
});

// ---------------------------------------------------------------------------
// RBAC User Management Endpoints (SaaS Admin Only)
// ---------------------------------------------------------------------------

// 6. List all users (Admin RBAC dashboard)
app.get("/admin/users", async (c) => {
  const currentUser = await getCurrentUser(c);
  if (!currentUser || currentUser.role !== "saas_admin") {
    return c.json(
      { success: false, error: "Access denied. SaaS Admin privilege required." },
      403
    );
  }

  const users = await authService.getAllUsers();
  return c.json({ success: true, data: users });
});

// 7. Update user role (saas_admin can promote/demote to saas_admin, merchant, customer)
app.patch("/admin/users/:id/role", async (c) => {
  const currentUser = await getCurrentUser(c);
  if (!currentUser || currentUser.role !== "saas_admin") {
    return c.json(
      { success: false, error: "Access denied. SaaS Admin privilege required." },
      403
    );
  }

  const userId = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));
  const newRole = body.role as UserRole;

  if (!["saas_admin", "merchant", "customer"].includes(newRole)) {
    return c.json({ success: false, error: "Invalid role specified" }, 400);
  }

  const updated = await authService.updateUserRole(userId, newRole);
  if (!updated) {
    return c.json({ success: false, error: "User not found or role update failed" }, 404);
  }

  return c.json({ success: true, data: updated });
});

// 8. Update user status (active / suspended)
app.patch("/admin/users/:id/status", async (c) => {
  const currentUser = await getCurrentUser(c);
  if (!currentUser || currentUser.role !== "saas_admin") {
    return c.json(
      { success: false, error: "Access denied. SaaS Admin privilege required." },
      403
    );
  }

  const userId = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));
  const status = body.status;

  if (!["active", "suspended"].includes(status)) {
    return c.json({ success: false, error: "Invalid status specified" }, 400);
  }

  const updated = await authService.updateUserStatus(userId, status);
  if (!updated) {
    return c.json({ success: false, error: "User not found or status update failed" }, 404);
  }

  return c.json({ success: true, data: updated });
});

// 9. Delete user
app.delete("/admin/users/:id", async (c) => {
  const currentUser = await getCurrentUser(c);
  if (!currentUser || currentUser.role !== "saas_admin") {
    return c.json(
      { success: false, error: "Access denied. SaaS Admin privilege required." },
      403
    );
  }

  const userId = c.req.param("id");
  if (userId === currentUser.id) {
    return c.json({ success: false, error: "You cannot delete your own SaaS Admin account" }, 400);
  }

  const deleted = await authService.deleteUser(userId);
  if (!deleted) {
    return c.json({ success: false, error: "Failed to delete user" }, 404);
  }

  return c.json({ success: true, message: "User account deleted successfully" });
});

// ---------------------------------------------------------------------------
// Product & Studio Endpoints (With RBAC Guards)
// ---------------------------------------------------------------------------

// List Products (Accessible to All: Customer, Merchant, SaaS Admin)
app.get("/products", async (c) => {
  const dbProducts = await supabaseDb.getAllProducts();
  const products = dbProducts.length > 0 ? dbProducts : inMemoryStore.getAll();
  return c.json({
    success: true,
    data: products,
  });
});

// Get Product By ID (Accessible to All)
app.get("/products/:id", async (c) => {
  const id = c.req.param("id");
  const product = (await supabaseDb.getProductById(id)) || inMemoryStore.getById(id);
  if (!product) {
    return c.json({ success: false, error: "Product not found" }, 404);
  }
  return c.json({ success: true, data: product });
});

// Create Product (Merchant or SaaS Admin Only)
app.post("/products", zValidator("json", createProductSchema), async (c) => {
  const currentUser = await getCurrentUser(c);
  if (currentUser && currentUser.role === "customer") {
    return c.json(
      {
        success: false,
        error: "Customer accounts are view-only. Merchant permission is required to create furniture.",
      },
      403
    );
  }

  const body = c.req.valid("json");
  const id = `prod-${Date.now()}`;

  const newProduct: StoredProduct = {
    id,
    merchantId: currentUser ? currentUser.id : DEMO_MERCHANT.id,
    name: body.name,
    category: body.category,
    description: body.description || null,
    widthMm: Math.round(body.widthMm),
    depthMm: Math.round(body.depthMm),
    heightMm: Math.round(body.heightMm),
    priceBdt: Math.round(body.priceBdt || 18500),
    generationMode: body.generationMode || (body.images.length === 1 ? "image_to_3d" : "multi_image_to_3d"),
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

  await supabaseDb.createProduct(newProduct);
  inMemoryStore.add(newProduct);

  return c.json({ success: true, data: newProduct }, 201);
});

// Delete Product (Merchant or SaaS Admin Only)
app.delete("/products/:id", async (c) => {
  const currentUser = await getCurrentUser(c);
  if (currentUser && currentUser.role === "customer") {
    return c.json(
      { success: false, error: "Customer accounts cannot delete products." },
      403
    );
  }

  const id = c.req.param("id");
  const product = (await supabaseDb.getProductById(id)) || inMemoryStore.getById(id);
  if (!product) {
    return c.json({ success: false, error: "Product not found" }, 404);
  }

  // Delete assets from Supabase storage
  await storageService.deleteProductAssets(id);
  await supabaseDb.deleteProduct(id);
  inMemoryStore.delete(id);

  return c.json({ success: true, message: "Product deleted successfully" });
});

// Start Generation (Meshy AI Multi-Image) - Merchant or SaaS Admin Only
app.post("/products/:id/generate", async (c) => {
  const currentUser = await getCurrentUser(c);
  if (currentUser && currentUser.role === "customer") {
    return c.json(
      { success: false, error: "Customer accounts cannot trigger 3D model generation." },
      403
    );
  }

  const id = c.req.param("id");
  const product = (await supabaseDb.getProductById(id)) || inMemoryStore.getById(id);
  if (!product) {
    return c.json({ success: false, error: "Product not found" }, 404);
  }

  const isSingleImage =
    product.generationMode === "image_to_3d" || product.images.length === 1;

  if (isSingleImage && product.images.length < 1) {
    return c.json(
      { success: false, error: "Product must have at least 1 image for Single Image to 3D" },
      400
    );
  }

  if (!isSingleImage && product.images.length < 4) {
    return c.json(
      { success: false, error: "Multi-Image to 3D requires all 4 angle views (front, back, left, right)" },
      400
    );
  }

  const attemptId = `gen-${Date.now()}`;
  const settings = await supabaseDb.getSystemSettings();
  meshyClient.updateConfig(settings.meshyApiKey, settings.meshyApiBaseUrl);
  const creditEstimate = isSingleImage ? 10 : settings.meshyCreditsPerGeneration;

  try {
    let taskId: string;
    if (isSingleImage) {
      const res = await meshyClient.createImageTo3dTask({
        imageUrl: product.images[0].publicUrl,
        shouldTexture: true,
        textureResolution: (settings.meshyTextureResolution as "2k" | "4k" | "8k") || "2k",
        enablePbr: true,
        modelType: settings.meshyGeometryResolution === "high_poly" ? "high_poly" : "standard",
      });
      taskId = res.taskId;
    } else {
      const viewOrder = ["front", "back", "left", "right"];
      const orderedImages = [...product.images].sort(
        (a, b) => viewOrder.indexOf(a.viewType) - viewOrder.indexOf(b.viewType)
      );
      const imageUrls = orderedImages.map((img) => img.publicUrl);

      const res = await meshyClient.createMultiImageTask({
        imageUrls,
        shouldTexture: true,
        textureResolution: (settings.meshyTextureResolution as "2k" | "4k" | "8k") || "2k",
        enablePbr: true,
        modelType: settings.meshyGeometryResolution === "high_poly" ? "high_poly" : "standard",
      });
      taskId = res.taskId;
    }

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

    await supabaseDb.addGenerationAttempt(id, newAttempt);
    await supabaseDb.updateProductStatus(id, "processing");

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

    await supabaseDb.addGenerationAttempt(id, failedAttempt);
    await supabaseDb.updateProductStatus(id, "failed");

    inMemoryStore.update(id, (p) => ({
      ...p,
      status: "failed",
      updatedAt: new Date().toISOString(),
      generationAttempts: [failedAttempt, ...p.generationAttempts],
    }));

    return c.json({ success: false, error: errorMessage }, 500);
  }
});

// Check Generation Status (Accessible to All)
app.get("/products/:id/status", async (c) => {
  const id = c.req.param("id");
  let product = await supabaseDb.getProductById(id);
  const memProd = inMemoryStore.getById(id);
  if (product && memProd && product.generationAttempts.length === 0 && memProd.generationAttempts.length > 0) {
    product.generationAttempts = memProd.generationAttempts;
  }
  if (!product) {
    product = memProd;
  }
  if (!product) {
    return c.json({ success: false, error: "Product not found" }, 404);
  }

  const latestAttempt = product.generationAttempts[0];
  if (!latestAttempt) {
    if (product.status === "completed") {
      return c.json({
        success: true,
        data: { status: "completed", progress: 100 },
      });
    }
    return c.json({
      success: true,
      data: { status: product.status, progress: product.status === "processing" ? 30 : 0 },
    });
  }

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

  if (latestAttempt.providerTaskId) {
    try {
      const settings = await supabaseDb.getSystemSettings();
      meshyClient.updateConfig(settings.meshyApiKey, settings.meshyApiBaseUrl);

      const mode = product.generationMode || (product.images.length === 1 ? "image_to_3d" : "multi_image_to_3d");
      const task = await meshyClient.getTaskStatus(latestAttempt.providerTaskId, mode);

      if (task.status === "SUCCEEDED" && (task.model_urls?.glb || task.model_url)) {
        const modelUrl = task.model_urls?.glb || task.model_url || "";

        await supabaseDb.updateGenerationAttempt(latestAttempt.id, {
          status: "completed",
          modelUrl,
          completedAt: new Date().toISOString(),
        });
        await supabaseDb.updateProductStatus(id, "completed");

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

        await supabaseDb.updateGenerationAttempt(latestAttempt.id, {
          status: "failed",
          errorMessage: errorMsg,
          errorCode: "PROVIDER_FAILED",
          completedAt: new Date().toISOString(),
        });
        await supabaseDb.updateProductStatus(id, "failed");

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

// Retry Generation (Merchant or SaaS Admin Only)
app.post("/products/:id/retry", async (c) => {
  const currentUser = await getCurrentUser(c);
  if (currentUser && currentUser.role === "customer") {
    return c.json(
      { success: false, error: "Customer accounts cannot retry or trigger 3D generation." },
      403
    );
  }

  const id = c.req.param("id");
  const product = (await supabaseDb.getProductById(id)) || inMemoryStore.getById(id);
  if (!product) {
    return c.json({ success: false, error: "Product not found" }, 404);
  }

  const isSingleImage =
    product.generationMode === "image_to_3d" || product.images.length === 1;

  const attemptId = `gen-retry-${Date.now()}`;
  const settings = await supabaseDb.getSystemSettings();
  meshyClient.updateConfig(settings.meshyApiKey, settings.meshyApiBaseUrl);
  const creditEstimate = isSingleImage ? 10 : settings.meshyCreditsPerGeneration;

  try {
    let taskId: string;
    if (isSingleImage) {
      const res = await meshyClient.createImageTo3dTask({
        imageUrl: product.images[0].publicUrl,
        shouldTexture: true,
        textureResolution: (settings.meshyTextureResolution as "2k" | "4k" | "8k") || "2k",
        enablePbr: true,
        modelType: settings.meshyGeometryResolution === "high_poly" ? "high_poly" : "standard",
      });
      taskId = res.taskId;
    } else {
      const viewOrder = ["front", "back", "left", "right"];
      const orderedImages = [...product.images].sort(
        (a, b) => viewOrder.indexOf(a.viewType) - viewOrder.indexOf(b.viewType)
      );
      const imageUrls = orderedImages.map((img) => img.publicUrl);

      const res = await meshyClient.createMultiImageTask({
        imageUrls,
        shouldTexture: true,
        textureResolution: (settings.meshyTextureResolution as "2k" | "4k" | "8k") || "2k",
        enablePbr: true,
        modelType: settings.meshyGeometryResolution === "high_poly" ? "high_poly" : "standard",
      });
      taskId = res.taskId;
    }

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

    await supabaseDb.addGenerationAttempt(id, newAttempt);
    await supabaseDb.updateProductStatus(id, "processing");

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

// Cancel 3D Generation Task (Merchant or SaaS Admin)
app.post("/products/:id/cancel", async (c) => {
  const currentUser = await getCurrentUser(c);
  if (currentUser && currentUser.role === "customer") {
    return c.json(
      { success: false, error: "Customer accounts cannot cancel 3D generation." },
      403
    );
  }

  const id = c.req.param("id");
  const product = (await supabaseDb.getProductById(id)) || inMemoryStore.getById(id);
  if (!product) {
    return c.json({ success: false, error: "Product not found" }, 404);
  }

  if (product.status === "completed") {
    return c.json(
      { success: false, error: "Cannot cancel an already completed 3D generation." },
      400
    );
  }

  const now = new Date().toISOString();
  let body: { resetToDraft?: boolean } = {};
  try {
    body = await c.req.json();
  } catch {
    body = {};
  }
  const targetStatus = body.resetToDraft ? "draft" : "failed";

  const latestAttempt = product.generationAttempts[0];
  if (latestAttempt && (latestAttempt.status === "processing" || latestAttempt.status === "queued")) {
    await supabaseDb.updateGenerationAttempt(latestAttempt.id, {
      status: "failed",
      errorCode: "CANCELLED_BY_USER",
      errorMessage: "Generation was cancelled by the user.",
      completedAt: now,
    });
  }

  await supabaseDb.updateProductStatus(id, targetStatus);

  inMemoryStore.update(id, (p) => {
    const updatedAttempts = [...p.generationAttempts];
    if (
      updatedAttempts[0] &&
      (updatedAttempts[0].status === "processing" || updatedAttempts[0].status === "queued")
    ) {
      updatedAttempts[0] = {
        ...updatedAttempts[0],
        status: "failed",
        errorCode: "CANCELLED_BY_USER",
        errorMessage: "Generation was cancelled by the user.",
        completedAt: now,
      };
    }
    return {
      ...p,
      status: targetStatus,
      updatedAt: now,
      generationAttempts: updatedAttempts,
    };
  });

  const updatedProduct = (await supabaseDb.getProductById(id)) || inMemoryStore.getById(id);

  return c.json({
    success: true,
    message: "Generation cancelled successfully",
    data: updatedProduct,
  });
});

// Proxy 3D Model file to prevent CORS blocking from external CDNs (e.g. assets.meshy.ai)
app.get("/proxy-model", async (c) => {
  const url = c.req.query("url");
  if (!url) {
    return c.text("Missing url query param", 400);
  }

  try {
    const res = await fetch(url);
    if (!res.ok) {
      return c.text(
        `Failed to fetch 3D model: ${res.statusText}`,
        (res.status >= 400 && res.status < 600 ? res.status : 500) as 400 | 404 | 500
      );
    }
    const contentType = res.headers.get("content-type") || "model/gltf-binary";
    const arrayBuffer = await res.arrayBuffer();

    return new Response(arrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      },
    });
  } catch (err: unknown) {
    return c.text(err instanceof Error ? err.message : "Failed to proxy model", 500);
  }
});

// Credits & Usage Analytics (Merchant or SaaS Admin Only)
app.get("/credits/usage", async (c) => {
  const currentUser = await getCurrentUser(c);
  if (currentUser && currentUser.role === "customer") {
    return c.json(
      { success: false, error: "Credits and usage analytics are reserved for Merchants and SaaS Admins." },
      403
    );
  }

  const dbProducts = await supabaseDb.getAllProducts();
  const products = dbProducts.length > 0 ? dbProducts : inMemoryStore.getAll();
  const allAttempts = products.flatMap((p) => p.generationAttempts);

  const totalAttempts = allAttempts.length;
  const completedAttempts = allAttempts.filter((a) => a.status === "completed").length;
  const failedAttempts = allAttempts.filter((a) => a.status === "failed").length;
  const processingAttempts = allAttempts.filter((a) => a.status === "processing").length;

  const settings = await supabaseDb.getSystemSettings();
  const creditsPerGen = settings.meshyCreditsPerGeneration;
  const costPerCreditUSD = settings.costPerCreditUsd;
  const usdToBdtRate = settings.usdToBdtRate;

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

// ---------------------------------------------------------------------------
// SaaS Admin System Settings Endpoints (Stored in DB)
// ---------------------------------------------------------------------------

// 1. Get System Settings (Admin only)
app.get("/admin/settings", async (c) => {
  const currentUser = await getCurrentUser(c);
  if (!currentUser || currentUser.role !== "saas_admin") {
    return c.json({ success: false, error: "Access denied. SaaS Admin role required." }, 403);
  }

  const settings = await supabaseDb.getSystemSettings();
  return c.json({ success: true, data: settings });
});

// 2. Update System Settings (Admin only)
const updateSystemSettingsSchema = z.object({
  meshyApiKey: z.string().optional(),
  meshyApiBaseUrl: z.string().optional(),
  meshyModel: z.string().optional(),
  meshyGeometryResolution: z.string().optional(),
  meshyTextureResolution: z.string().optional(),
  meshyCreditsPerGeneration: z.number().int().positive().optional(),
  usdToBdtRate: z.number().positive().optional(),
  costPerCreditUsd: z.number().positive().optional(),
});

app.patch("/admin/settings", zValidator("json", updateSystemSettingsSchema), async (c) => {
  const currentUser = await getCurrentUser(c);
  if (!currentUser || currentUser.role !== "saas_admin") {
    return c.json({ success: false, error: "Access denied. SaaS Admin role required." }, 403);
  }

  const body = c.req.valid("json");
  const res = await supabaseDb.updateSystemSettings(body);
  if (res.success && res.data) {
    meshyClient.updateConfig(res.data.meshyApiKey, res.data.meshyApiBaseUrl);
  }

  return c.json(res);
});

// ---------------------------------------------------------------------------
// Merchant Public Storefront & Settings Endpoints
// ---------------------------------------------------------------------------

// 1. Get Merchant Public Profile & Catalog (Publicly Accessible)
app.get("/merchants/:id/public", async (c) => {
  const merchantId = c.req.param("id");
  const profile = await supabaseDb.getMerchantPublicProfile(merchantId);

  if (!profile) {
    return c.json({ success: false, error: "Merchant not found" }, 404);
  }

  return c.json({ success: true, data: profile });
});

// 2. Get Current Merchant Profile (For Settings Page)
app.get("/merchants/profile", async (c) => {
  const currentUser = await getCurrentUser(c);
  const targetId = currentUser?.id || "demo-merchant-001";
  const profile = await supabaseDb.getMerchantPublicProfile(targetId);

  if (!profile) {
    return c.json({ success: false, error: "Merchant profile not found" }, 404);
  }

  return c.json({ success: true, data: profile });
});

// 3. Update Merchant Profile (Merchant, Admin, or Demo Merchant)
const updateMerchantSchema = z.object({
  businessName: z.string().max(100).optional(),
  bio: z.string().max(500).optional(),
  whatsappNumber: z.string().max(25).optional(),
  location: z.string().max(100).optional(),
  name: z.string().max(100).optional(),
  email: z.string().email().optional(),
});

app.patch("/merchants/profile", zValidator("json", updateMerchantSchema), async (c) => {
  const currentUser = await getCurrentUser(c);
  // Demo merchant account can edit without active session cookie; otherwise use logged-in user id
  const targetId = currentUser?.id || "demo-merchant-001";

  const body = c.req.valid("json");
  const res = await supabaseDb.updateMerchantProfile(targetId, body);
  if (!res.success) {
    return c.json({ success: false, error: "Failed to update merchant profile in database" }, 500);
  }
  return c.json({ success: true, message: "Merchant profile updated successfully" });
});

// 3. Check if current user follows merchant
app.get("/merchants/:id/is-following", async (c) => {
  const currentUser = await getCurrentUser(c);
  if (!currentUser) {
    return c.json({ success: true, data: { isFollowing: false } });
  }

  const merchantId = c.req.param("id");
  const isFollowing = await supabaseDb.getIsFollowing(merchantId, currentUser.id);
  return c.json({ success: true, data: { isFollowing } });
});

// 4. Follow Merchant
app.post("/merchants/:id/follow", async (c) => {
  const currentUser = await getCurrentUser(c);
  if (!currentUser) {
    return c.json({ success: false, error: "Authentication required to follow merchant" }, 401);
  }

  const merchantId = c.req.param("id");
  const res = await supabaseDb.followMerchant(merchantId, currentUser.id);
  return c.json(res);
});

// 5. Unfollow Merchant
app.delete("/merchants/:id/follow", async (c) => {
  const currentUser = await getCurrentUser(c);
  if (!currentUser) {
    return c.json({ success: false, error: "Authentication required" }, 401);
  }

  const merchantId = c.req.param("id");
  const res = await supabaseDb.unfollowMerchant(merchantId, currentUser.id);
  return c.json(res);
});

// ---------------------------------------------------------------------------
// Customer Wishlist Endpoints
// ---------------------------------------------------------------------------

// 1. Get current customer wishlist product IDs
app.get("/wishlists", async (c) => {
  const currentUser = await getCurrentUser(c);
  if (!currentUser) {
    return c.json({ success: true, data: [] });
  }

  const productIds = await supabaseDb.getCustomerWishlist(currentUser.id);
  return c.json({ success: true, data: productIds });
});

// 2. Toggle item in wishlist
app.post("/wishlists/:productId/toggle", async (c) => {
  const currentUser = await getCurrentUser(c);
  if (!currentUser) {
    return c.json({ success: false, error: "Authentication required for wishlist" }, 401);
  }

  const productId = c.req.param("productId");
  const res = await supabaseDb.toggleWishlist(currentUser.id, productId);
  return c.json({ success: true, data: res });
});

