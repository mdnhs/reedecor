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

  if (product.images.length !== 4) {
    return c.json(
      { success: false, error: "Product must have all 4 angle images to generate 3D model" },
      400
    );
  }

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
  const product = (await supabaseDb.getProductById(id)) || inMemoryStore.getById(id);
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
      const task = await meshyClient.getTaskStatus(latestAttempt.providerTaskId);

      if (task.status === "SUCCEEDED" && task.model_urls?.glb) {
        const modelUrl = task.model_urls.glb;

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
