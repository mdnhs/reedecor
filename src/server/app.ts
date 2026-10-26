import { Hono, Context, type MiddlewareHandler } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { inMemoryStore, StoredProduct } from "./demo-store";
import { supabaseDb } from "@/lib/supabase/db";
import { meshyClient } from "@/lib/meshy/client";
import { storageService } from "@/lib/storage/supabase-storage";
import { authService, AppUser, UserRole } from "@/lib/supabase/auth-service";
import { assetRoutes } from "./asset-routes";
import { sceneRoutes } from "./scene-routes";
import { featureRoutes } from "./feature-routes";
import { featureFlags, featureOffResponse, requireFeature } from "./feature-service";
import { canManageProduct, isDemoMode, isStaff, PUBLIC_REGISTRATION_ROLES } from "./access";
import { createFailureLimiter } from "./rate-limit";
import { decodeImageDataUrl, IMAGE_EXTENSIONS, MAX_PRODUCT_REQUEST_BYTES } from "./product-images";
import { bodyLimit } from "hono/body-limit";
import {
  creditsUsed,
  DEFAULT_CREDIT_ALLOWANCE,
  SINGLE_IMAGE_CREDIT_COST,
  settledStatus,
  startGeneration,
  syncGenerationStatus,
} from "./generation";
import {
  isAllowedMeshyBaseUrl,
  isAllowedModelUrl,
  MASK_PREFIX,
  maskSecret,
  MAX_PROXY_BYTES,
  readBodyWithLimit,
} from "./proxy-allowlist";

export const app = new Hono().basePath("/api");

app.onError((err, c) => {
  console.error("[API] Unhandled error:", err);
  return c.json({ success: false, error: err.message || "Unexpected server error" }, 500);
});

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

type Guarded<T> = T | { error: Response };

async function requireStaff(c: Context): Promise<Guarded<{ user: AppUser }>> {
  const user = await getCurrentUser(c);
  if (!user) return { error: c.json({ success: false, error: "Sign in required." }, 401) };
  if (!isStaff(user)) {
    return { error: c.json({ success: false, error: "Merchant or admin access required." }, 403) };
  }
  return { user };
}

async function allProducts(): Promise<StoredProduct[]> {
  const dbProducts = await supabaseDb.getAllProducts();
  return supabaseDb.isConfigured() ? dbProducts : inMemoryStore.getAll();
}

async function merchantProducts(merchantId: string): Promise<StoredProduct[]> {
  return (await allProducts()).filter((p) => p.merchantId === merchantId);
}

const staffOnly: MiddlewareHandler = async (c, next) => {
  const staff = await requireStaff(c);
  if ("error" in staff) return staff.error;
  await next();
};

async function requireManagedProduct(
  c: Context,
  id: string
): Promise<Guarded<{ user: AppUser; product: StoredProduct }>> {
  const staff = await requireStaff(c);
  if ("error" in staff) return staff;
  const product = (await supabaseDb.getProductById(id)) || inMemoryStore.getById(id);
  if (!product) return { error: c.json({ success: false, error: "Product not found" }, 404) };
  if (!canManageProduct(staff.user, product)) {
    return { error: c.json({ success: false, error: "You can only manage your own products." }, 403) };
  }
  return { user: staff.user, product };
}

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------
const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(PUBLIC_REGISTRATION_ROLES).default("customer"),
});

const adminCreateUserSchema = registerSchema.extend({
  role: z.enum(["saas_admin", "merchant", "customer"]),
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
    priceBdt: z.number().nonnegative("Price cannot be negative").optional(),
    generationMode: z
      .enum(["image_to_3d", "multi_image_to_3d"])
      .default("multi_image_to_3d"),
    images: z
      .array(
        z.object({
          viewType: z.enum(["front", "back", "left", "right", "single"]),
          publicUrl: z.string(),
          fileName: z.string().max(200),
          mimeType: z.string(),
          fileSizeBytes: z.number().nonnegative(),
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
    return c.json({ success: false, error: "Not signed in", data: { demoMode: isDemoMode() } }, 401);
  }
  return c.json({
    success: true,
    data: { ...user, demoMode: isDemoMode() },
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
const loginFailures = createFailureLimiter({ limit: 5, windowMs: 15 * 60_000 });

app.post("/auth/login", zValidator("json", loginSchema), async (c) => {
  const { email, password } = c.req.valid("json");
  const throttleKey = email.trim().toLowerCase();
  if (loginFailures.isBlocked(throttleKey)) {
    return c.json({ success: false, error: "Too many sign-in attempts. Try again in 15 minutes." }, 429);
  }
  try {
    const user = await authService.verifyCredentials(email, password);
    if (!user) {
      loginFailures.recordFailure(throttleKey);
      return c.json({ success: false, error: "Invalid email or password" }, 401);
    }
    loginFailures.reset(throttleKey);

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
  if (!isDemoMode()) {
    return c.json({ success: false, error: "Not found" }, 404);
  }
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

// Admin-created accounts never touch the caller's session cookie
app.post("/admin/users", zValidator("json", adminCreateUserSchema), async (c) => {
  const currentUser = await getCurrentUser(c);
  if (!currentUser || currentUser.role !== "saas_admin") {
    return c.json({ success: false, error: "Access denied. SaaS Admin privilege required." }, 403);
  }

  const { name, email, password, role } = c.req.valid("json");
  try {
    const user = await authService.createUser(email, password, name, role as UserRole);
    return c.json({ success: true, data: user }, 201);
  } catch (err: unknown) {
    return c.json(
      { success: false, error: err instanceof Error ? err.message : "Could not create user" },
      400
    );
  }
});

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

app.patch("/admin/users/:id/plan", async (c) => {
  const currentUser = await getCurrentUser(c);
  if (!currentUser || currentUser.role !== "saas_admin") {
    return c.json(
      { success: false, error: "Access denied. SaaS Admin privilege required." },
      403
    );
  }

  const body = await c.req.json().catch(() => ({}));
  if (body.plan !== "free" && body.plan !== "pro") {
    return c.json({ success: false, error: "Plan must be 'free' or 'pro'" }, 400);
  }

  const updated = await authService.updateUserPlan(c.req.param("id"), body.plan);
  if (!updated) {
    return c.json({ success: false, error: "User not found or plan update failed" }, 404);
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

app.route("/", assetRoutes(getCurrentUser));
app.route("/", sceneRoutes(getCurrentUser));
app.route("/", featureRoutes(getCurrentUser));

// ---------------------------------------------------------------------------
// Product & Studio Endpoints (With RBAC Guards)
// ---------------------------------------------------------------------------

// List Products (Accessible to All: Customer, Merchant, SaaS Admin)
app.get("/products", async (c) => {
  const currentUser = await getCurrentUser(c);
  if (!currentUser) {
    return c.json({ success: false, error: "Sign in required." }, 401);
  }

  const products = await allProducts();
  const visible =
    currentUser.role === "saas_admin"
      ? products
      : currentUser.role === "merchant"
      ? products.filter((p) => p.merchantId === currentUser.id)
      : products.filter((p) => p.status === "completed");
  return c.json({ success: true, data: visible });
});

// Get Product By ID (Accessible to All)
app.get("/products/:id", async (c) => {
  const id = c.req.param("id");
  const product = (await supabaseDb.getProductById(id)) || inMemoryStore.getById(id);
  if (!product) {
    return c.json({ success: false, error: "Product not found" }, 404);
  }
  if (product.status !== "completed" && !canManageProduct(await getCurrentUser(c), product)) {
    return c.json({ success: false, error: "Product not found" }, 404);
  }
  return c.json({ success: true, data: product });
});

// Create Product (Merchant or SaaS Admin Only)
const productBodyLimit = bodyLimit({
  maxSize: MAX_PRODUCT_REQUEST_BYTES,
  onError: (c) => c.json({ success: false, error: "Photos are too large. Use images of 10 MB or less." }, 413),
});

app.post("/products", requireFeature("model_generation"), staffOnly, productBodyLimit, zValidator("json", createProductSchema), async (c) => {
  const staff = await requireStaff(c);
  if ("error" in staff) return staff.error;

  const body = c.req.valid("json");
  const id = `prod-${Date.now()}`;

  const decoded = body.images.map((img) => ({ img, file: decodeImageDataUrl(img.publicUrl) }));
  const invalid = decoded.find(({ file }) => "error" in file);
  if (invalid && "error" in invalid.file) {
    return c.json({ success: false, error: invalid.file.error }, 400);
  }

  const images: StoredProduct["images"] = [];
  const newProduct: StoredProduct = {
    id,
    merchantId: staff.user.id,
    name: body.name,
    category: body.category,
    description: body.description || null,
    widthMm: Math.round(body.widthMm),
    depthMm: Math.round(body.depthMm),
    heightMm: Math.round(body.heightMm),
    priceBdt: Math.round(body.priceBdt ?? 0),
    generationMode: body.generationMode || (body.images.length === 1 ? "image_to_3d" : "multi_image_to_3d"),
    status: "draft",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    images,
    generationAttempts: [],
  };

  try {
    for (const [idx, { img, file }] of decoded.entries()) {
      if ("error" in file) continue;
      const fileName = `${img.viewType}.${IMAGE_EXTENSIONS[file.mimeType]}`;
      const upload = await storageService.uploadProductImage(file.buffer, fileName, id, img.viewType);
      images.push({
        id: `img-${id}-${idx}`,
        viewType: img.viewType,
        publicUrl: upload.publicUrl,
        storagePath: upload.path,
        fileName: img.fileName,
        mimeType: file.mimeType,
        fileSizeBytes: file.buffer.length,
      });
    }
    await supabaseDb.createProduct(newProduct);
  } catch (err) {
    await storageService
      .removeAssetFiles(images.map((img) => img.storagePath))
      .catch((cleanupErr) => console.error("[Products] Could not remove uploaded photos:", cleanupErr));
    throw err;
  }
  inMemoryStore.add(newProduct);

  return c.json({ success: true, data: newProduct }, 201);
});

const THUMBNAIL_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"];
const THUMBNAIL_MAX_BYTES = 1.5 * 1024 * 1024;

// Set Product Thumbnail (owner or admin)
app.post("/products/:id/thumbnail", async (c) => {
  if (!(await featureFlags.isEnabled("capture_thumbnails"))) return featureOffResponse(c);
  const id = c.req.param("id");
  const guard = await requireManagedProduct(c, id);
  if ("error" in guard) return guard.error;

  const mimeType = (c.req.header("Content-Type") || "").split(";")[0].trim();
  if (!THUMBNAIL_MIME_TYPES.includes(mimeType)) {
    return c.json({ success: false, error: "Thumbnail must be a PNG, JPEG or WebP image." }, 400);
  }

  const buffer = Buffer.from(await c.req.arrayBuffer());
  if (buffer.length === 0 || buffer.length > THUMBNAIL_MAX_BYTES) {
    return c.json({ success: false, error: "Thumbnail must be between 1 byte and 1.5 MB." }, 400);
  }

  try {
    const upload = await storageService.uploadProductThumbnail(buffer, mimeType, id);
    await supabaseDb.updateProductThumbnail(id, upload.publicUrl);
    inMemoryStore.update(id, (p) => ({ ...p, thumbnailUrl: upload.publicUrl }));
    return c.json({ success: true, data: { thumbnailUrl: upload.publicUrl } });
  } catch (err) {
    console.error("Thumbnail upload failed:", err);
    const detail = err instanceof Error ? err.message : "unknown error";
    return c.json({ success: false, error: `Could not save thumbnail: ${detail}` }, 500);
  }
});

// Delete Product (Merchant or SaaS Admin Only)
app.delete("/products/:id", async (c) => {
  const id = c.req.param("id");
  const guard = await requireManagedProduct(c, id);
  if ("error" in guard) return guard.error;

  // Delete assets from Supabase storage
  await storageService.deleteProductAssets(id);
  await supabaseDb.deleteProduct(id);
  inMemoryStore.delete(id);

  return c.json({ success: true, message: "Product deleted successfully" });
});

// Start Generation (Meshy AI Multi-Image) - Merchant or SaaS Admin Only
app.post("/products/:id/generate", async (c) => {
  if (!(await featureFlags.isEnabled("model_generation"))) return featureOffResponse(c);
  const id = c.req.param("id");
  const guard = await requireManagedProduct(c, id);
  if ("error" in guard) return guard.error;

  const settings = await supabaseDb.getSystemSettings();
  const used = creditsUsed(await merchantProducts(guard.product.merchantId));
  const result = await startGeneration(guard.product, settings, used, `gen-${Date.now()}`);
  if (result.status !== 200) {
    return c.json({ success: false, error: result.error }, result.status);
  }
  return c.json({
    success: true,
    data: { attemptId: result.attempt.id, providerTaskId: result.attempt.providerTaskId, status: "processing" },
  });
});

// Check Generation Status (also advances the attempt when Meshy reports a result)
app.get("/products/:id/status", async (c) => {
  const id = c.req.param("id");
  const product = (await supabaseDb.getProductById(id)) || inMemoryStore.getById(id);
  if (!product) {
    return c.json({ success: false, error: "Product not found" }, 404);
  }

  if (!canManageProduct(await getCurrentUser(c), product)) {
    if (product.status !== "completed") return c.json({ success: false, error: "Product not found" }, 404);
    return c.json({ success: true, data: settledStatus(product).body });
  }

  const settings = await supabaseDb.getSystemSettings();
  const result = await syncGenerationStatus(product, settings);
  return c.json({ success: result.httpStatus === 200, data: result.body }, result.httpStatus);
});

// Retry Generation (Merchant or SaaS Admin Only)
app.post("/products/:id/retry", async (c) => {
  if (!(await featureFlags.isEnabled("model_generation"))) return featureOffResponse(c);
  const id = c.req.param("id");
  const guard = await requireManagedProduct(c, id);
  if ("error" in guard) return guard.error;

  const settings = await supabaseDb.getSystemSettings();
  const used = creditsUsed(await merchantProducts(guard.product.merchantId));
  const result = await startGeneration(guard.product, settings, used, `gen-retry-${Date.now()}`);
  if (result.status !== 200) {
    return c.json({ success: false, error: result.error }, result.status);
  }
  return c.json({
    success: true,
    data: { attemptId: result.attempt.id, providerTaskId: result.attempt.providerTaskId, status: "processing" },
  });
});

// Cancel 3D Generation Task (Merchant or SaaS Admin)
app.post("/products/:id/cancel", async (c) => {
  const id = c.req.param("id");
  const guard = await requireManagedProduct(c, id);
  if ("error" in guard) return guard.error;
  const { product } = guard;

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
  const hasEarlierModel = product.generationAttempts.some((a, i) => i > 0 && a.status === "completed" && a.modelUrl);
  const targetStatus = hasEarlierModel ? "completed" : body.resetToDraft ? "draft" : "failed";

  const latestAttempt = product.generationAttempts[0];
  if (latestAttempt && (latestAttempt.status === "processing" || latestAttempt.status === "queued")) {
    const cancelled = {
      status: "failed" as const,
      errorCode: "CANCELLED_BY_USER",
      errorMessage: "Generation was cancelled by the user.",
      completedAt: now,
    };
    const applied = await supabaseDb.updateGenerationAttempt(latestAttempt.id, cancelled, latestAttempt.status);
    if (!applied) {
      return c.json({ success: false, error: "This generation already finished and can no longer be cancelled." }, 409);
    }
    inMemoryStore.update(id, (p) => ({
      ...p,
      generationAttempts: p.generationAttempts.map((a) => (a.id === latestAttempt.id ? { ...a, ...cancelled } : a)),
    }));
  }

  await supabaseDb.updateProductStatus(id, targetStatus);
  inMemoryStore.update(id, (p) => ({ ...p, status: targetStatus, updatedAt: now }));

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
  if (!url || !isAllowedModelUrl(url)) {
    return c.text("Model URL is missing or not from an allowed host", 400);
  }

  try {
    const res = await fetch(url, { redirect: "error" });
    if (!res.ok) {
      return c.text(
        `Failed to fetch 3D model: ${res.statusText}`,
        (res.status >= 400 && res.status < 600 ? res.status : 502) as 400
      );
    }
    if (Number(res.headers.get("content-length") || 0) > MAX_PROXY_BYTES) {
      return c.text("3D model is too large to proxy", 413);
    }
    const body = await readBodyWithLimit(res, MAX_PROXY_BYTES);
    if (!body) {
      return c.text("3D model is too large to proxy", 413);
    }

    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": res.headers.get("content-type") || "model/gltf-binary",
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      },
    });
  } catch (err: unknown) {
    return c.text(err instanceof Error ? err.message : "Failed to proxy model", 500);
  }
});

// Credits & Usage Analytics (Merchant or SaaS Admin Only)
app.get("/credits/usage", async (c) => {
  const staff = await requireStaff(c);
  if ("error" in staff) return staff.error;

  const products =
    staff.user.role === "saas_admin" ? await allProducts() : await merchantProducts(staff.user.id);
  const attempts = products
    .flatMap((p) => p.generationAttempts.map((a) => ({ ...a, productId: p.id, productName: p.name })))
    .sort((x, y) => y.createdAt.localeCompare(x.createdAt));

  const settings = await supabaseDb.getSystemSettings();
  const used = creditsUsed(products);
  const totalCostUSD = used * settings.costPerCreditUsd;

  return c.json({
    success: true,
    data: {
      allowance: DEFAULT_CREDIT_ALLOWANCE,
      used,
      remaining: Math.max(0, DEFAULT_CREDIT_ALLOWANCE - used),
      singleImageCost: SINGLE_IMAGE_CREDIT_COST,
      multiImageCost: settings.meshyCreditsPerGeneration,
      totalAttempts: attempts.length,
      completedAttempts: attempts.filter((a) => a.status === "completed").length,
      failedAttempts: attempts.filter((a) => a.status === "failed").length,
      processingAttempts: attempts.filter((a) => a.status === "processing" || a.status === "queued").length,
      totalCostUSD,
      totalCostBDT: totalCostUSD * settings.usdToBdtRate,
      usdToBdtRate: settings.usdToBdtRate,
      costPerCreditUSD: settings.costPerCreditUsd,
      history: attempts.slice(0, 20),
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
  return c.json({ success: true, data: { ...settings, meshyApiKey: maskSecret(settings.meshyApiKey) } });
});

// 2. Update System Settings (Admin only)
const updateSystemSettingsSchema = z.object({
  meshyApiKey: z.string().optional(),
  meshyApiBaseUrl: z.string().refine(isAllowedMeshyBaseUrl, "Meshy base URL must be an https meshy.ai address").optional(),
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

  const { meshyApiKey, ...rest } = c.req.valid("json");
  const updates = meshyApiKey === undefined || meshyApiKey.startsWith(MASK_PREFIX) ? rest : { ...rest, meshyApiKey };
  const res = await supabaseDb.updateSystemSettings(updates);
  if (res.success && res.data) {
    meshyClient.updateConfig(res.data.meshyApiKey, res.data.meshyApiBaseUrl);
  }

  return c.json(res.success && res.data ? { ...res, data: { ...res.data, meshyApiKey: maskSecret(res.data.meshyApiKey) } } : res);
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
  if (!currentUser) {
    return c.json({ success: false, error: "Sign in required." }, 401);
  }
  const profile = await supabaseDb.getOwnMerchantProfile(currentUser.id);

  if (!profile) {
    return c.json({ success: false, error: "Merchant profile not found" }, 404);
  }

  return c.json({ success: true, data: profile });
});

// 3. Update Merchant Profile (Merchant or Admin)
const updateMerchantSchema = z.object({
  businessName: z.string().max(100).optional(),
  bio: z.string().max(500).optional(),
  whatsappNumber: z.string().max(25).optional(),
  location: z.string().max(100).optional(),
  name: z.string().max(100).optional(),
  email: z.string().email().optional(),
});

app.patch("/merchants/profile", zValidator("json", updateMerchantSchema), async (c) => {
  const staff = await requireStaff(c);
  if ("error" in staff) return staff.error;

  const body = c.req.valid("json");
  const res = await supabaseDb.updateMerchantProfile(staff.user.id, body);
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
  if (!currentUser || !(await featureFlags.isEnabled("wishlist"))) {
    return c.json({ success: true, data: [] });
  }

  const productIds = await supabaseDb.getCustomerWishlist(currentUser.id);
  return c.json({ success: true, data: productIds });
});

// 2. Toggle item in wishlist
app.post("/wishlists/:productId/toggle", async (c) => {
  if (!(await featureFlags.isEnabled("wishlist"))) return featureOffResponse(c);
  const currentUser = await getCurrentUser(c);
  if (!currentUser) {
    return c.json({ success: false, error: "Authentication required for wishlist" }, 401);
  }

  const productId = c.req.param("productId");
  const res = await supabaseDb.toggleWishlist(currentUser.id, productId);
  return c.json({ success: true, data: res });
});

