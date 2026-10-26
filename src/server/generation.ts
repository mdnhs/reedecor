import { meshyClient } from "@/lib/meshy/client";
import { supabaseDb, type SystemSettings } from "@/lib/supabase/db";
import { inMemoryStore, type StoredProduct } from "@/server/demo-store";
import { storageService } from "@/lib/storage/supabase-storage";

export const DEFAULT_CREDIT_ALLOWANCE = 100;
export const SINGLE_IMAGE_CREDIT_COST = 10;
export const UNCHARGED_ERROR_CODES = ["CANCELLED_BY_USER", "GENERATION_INIT_FAILED", "TIMEOUT"];

type Attempt = StoredProduct["generationAttempts"][number];
type ErrorStatus = 400 | 402 | 409 | 500 | 503;

export type GenerationResult =
  | { status: 200; attempt: Attempt }
  | { status: ErrorStatus; error: string };

const VIEW_ORDER = ["front", "back", "left", "right"];

export function isSingleImage(product: StoredProduct): boolean {
  return product.generationMode === "image_to_3d" || product.images.length === 1;
}

export function creditCost(product: StoredProduct, settings: SystemSettings): number {
  return isSingleImage(product) ? SINGLE_IMAGE_CREDIT_COST : settings.meshyCreditsPerGeneration;
}

export function creditsUsed(products: StoredProduct[]): number {
  return products
    .flatMap((p) => p.generationAttempts)
    .filter((a) => !isUncharged(a))
    .reduce((sum, a) => sum + (a.creditCostEstimate || 0), 0);
}

// A cancel only refunds when Meshy never received the task
function isUncharged(a: Attempt): boolean {
  if (a.status !== "failed") return false;
  if (a.errorCode === "CANCELLED_BY_USER") return !a.providerTaskId;
  return UNCHARGED_ERROR_CODES.includes(a.errorCode ?? "");
}

function rememberAttempt(productId: string, attempt: Attempt, status: StoredProduct["status"]) {
  inMemoryStore.update(productId, (p) => ({
    ...p,
    status,
    updatedAt: new Date().toISOString(),
    generationAttempts: [attempt, ...p.generationAttempts.filter((a) => a.id !== attempt.id)],
  }));
}

async function createTask(product: StoredProduct, settings: SystemSettings): Promise<string> {
  const common = {
    shouldTexture: true,
    textureResolution: (settings.meshyTextureResolution as "2k" | "4k" | "8k") || "2k",
    enablePbr: true,
    modelType: settings.meshyGeometryResolution === "high_poly" ? ("high_poly" as const) : ("standard" as const),
    aiModel: settings.meshyModel || "meshy-7.1",
  };
  if (isSingleImage(product)) {
    return (await meshyClient.createImageTo3dTask({ imageUrl: product.images[0].publicUrl, ...common })).taskId;
  }
  const imageUrls = [...product.images]
    .sort((a, b) => VIEW_ORDER.indexOf(a.viewType) - VIEW_ORDER.indexOf(b.viewType))
    .map((img) => img.publicUrl);
  return (await meshyClient.createMultiImageTask({ imageUrls, ...common })).taskId;
}

const ALREADY_RUNNING = "A 3D generation is already running for this product.";

export async function startGeneration(
  product: StoredProduct,
  settings: SystemSettings,
  usedCredits: number,
  attemptId: string,
  allowance: number = DEFAULT_CREDIT_ALLOWANCE
): Promise<GenerationResult> {
  const latest = product.generationAttempts[0];
  if (latest && (latest.status === "processing" || latest.status === "queued")) {
    return { status: 409, error: ALREADY_RUNNING };
  }

  const single = isSingleImage(product);
  if (single ? product.images.length < 1 : product.images.length < 4) {
    return {
      status: 400,
      error: single
        ? "Product must have at least 1 image for Single Image to 3D"
        : "Multi-Image to 3D requires all 4 angle views (front, back, left, right)",
    };
  }

  const cost = creditCost(product, settings);
  if (usedCredits + cost > allowance) {
    return { status: 402, error: `Not enough credits: this generation needs ${cost}, ${Math.max(0, allowance - usedCredits)} left.` };
  }

  meshyClient.updateConfig(settings.meshyApiKey, settings.meshyApiBaseUrl);
  if (!meshyClient.isConfigured() && process.env.NODE_ENV === "production") {
    return { status: 503, error: "3D generation is not configured. Ask an admin to add the Meshy API key." };
  }

  const now = new Date().toISOString();
  const queued: Attempt = {
    id: attemptId,
    provider: "meshy",
    providerTaskId: null,
    status: "queued",
    modelUrl: null,
    creditCostEstimate: cost,
    errorCode: null,
    errorMessage: null,
    createdAt: now,
    completedAt: null,
  };

  // The queued row is the lock: the partial unique index rejects a second active attempt
  try {
    await supabaseDb.addGenerationAttempt(product.id, queued);
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (/duplicate key|unique/i.test(message)) return { status: 409, error: ALREADY_RUNNING };
    throw err;
  }
  rememberAttempt(product.id, queued, product.status);

  let taskId: string;
  try {
    taskId = await createTask(product, settings);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to initiate generation";
    const failure = {
      status: "failed" as const,
      creditCostEstimate: 0,
      errorCode: "GENERATION_INIT_FAILED",
      errorMessage: message,
      completedAt: new Date().toISOString(),
    };
    const productStatus = product.status === "completed" ? "completed" : "failed";
    rememberAttempt(product.id, { ...queued, ...failure }, productStatus);
    try {
      await supabaseDb.updateGenerationAttempt(attemptId, failure, "queued");
      await supabaseDb.updateProductStatus(product.id, productStatus);
    } catch (dbErr) {
      console.error("[Generation] Could not record the failed start:", dbErr);
    }
    return { status: 500, error: message };
  }

  const attempt: Attempt = { ...queued, providerTaskId: taskId, status: "processing" };
  rememberAttempt(product.id, attempt, "processing");
  try {
    await supabaseDb.updateGenerationAttempt(attemptId, { providerTaskId: taskId, status: "processing" }, "queued");
    await supabaseDb.updateProductStatus(product.id, "processing");
  } catch (err) {
    console.error(`[Generation] Meshy task ${taskId} started but could not be saved:`, err);
    return {
      status: 500,
      error: `Generation started (Meshy task ${taskId}) but could not be saved. Contact support before retrying.`,
    };
  }

  return { status: 200, attempt };
}

export const GENERATION_TIMEOUT_MS = 30 * 60_000;

export interface StatusSync {
  httpStatus: 200 | 502;
  body: {
    status: StoredProduct["status"];
    progress?: number;
    modelUrl?: string | null;
    errorMessage?: string | null;
    error?: string;
  };
}

function patchMemoryAttempt(productId: string, attemptId: string, patch: Partial<Attempt>, status: StoredProduct["status"]) {
  inMemoryStore.update(productId, (p) => ({
    ...p,
    status,
    updatedAt: new Date().toISOString(),
    generationAttempts: p.generationAttempts.map((a) => (a.id === attemptId ? { ...a, ...patch } : a)),
  }));
}

async function cacheModel(sourceUrl: string, product: StoredProduct, attempt: Attempt): Promise<string> {
  try {
    const res = await fetch(sourceUrl);
    if (!res.ok) return sourceUrl;
    let buffer: Buffer = Buffer.from(await res.arrayBuffer());
    try {
      const { optimizeGlbBuffer } = await import("@/lib/storage/glb-optimizer");
      const optimized = await optimizeGlbBuffer(buffer, {
        provenance: { aiGenerated: true, provider: attempt.provider, taskId: attempt.providerTaskId ?? null },
      });
      buffer = Buffer.from(optimized.buffer, optimized.byteOffset, optimized.byteLength);
    } catch (optErr) {
      console.warn("[Meshy Sync] GLB optimization skipped:", optErr);
    }
    const upload = await storageService.uploadModelFile(buffer, `${attempt.id}.glb`, product.id);
    return upload?.publicUrl || sourceUrl;
  } catch (err) {
    console.warn("[Meshy Sync] Failed to cache GLB in Supabase Storage:", err);
    return sourceUrl;
  }
}

function bodyFor(attempt: Attempt): StatusSync["body"] {
  if (attempt.status === "completed") return { status: "completed", progress: 100, modelUrl: attempt.modelUrl };
  if (attempt.status === "failed") return { status: "failed", progress: 0, errorMessage: attempt.errorMessage };
  return { status: "processing" };
}

async function finishAttempt(
  product: StoredProduct,
  attempt: Attempt,
  patch: Partial<Attempt>
): Promise<StatusSync["body"]> {
  const applied = await supabaseDb.updateGenerationAttempt(attempt.id, patch, attempt.status);
  if (!applied) {
    const fresh = (await supabaseDb.getProductById(product.id))?.generationAttempts.find((a) => a.id === attempt.id);
    return fresh ? bodyFor(fresh) : { status: "processing" };
  }
  const hasEarlierModel = product.generationAttempts.some(
    (a) => a.id !== attempt.id && a.status === "completed" && a.modelUrl
  );
  const productStatus = patch.status === "completed" || hasEarlierModel ? "completed" : "failed";
  await supabaseDb.updateProductStatus(product.id, productStatus);
  patchMemoryAttempt(product.id, attempt.id, patch, productStatus);
  return bodyFor({ ...attempt, ...patch });
}

const inFlight = new Map<string, Promise<StatusSync>>();

export function syncGenerationStatus(
  product: StoredProduct,
  settings: SystemSettings,
  now: number = Date.now()
): Promise<StatusSync> {
  const attempt = product.generationAttempts[0];
  if (!attempt || (attempt.status !== "processing" && attempt.status !== "queued")) {
    return Promise.resolve(settledStatus(product));
  }
  const running = inFlight.get(attempt.id);
  if (running) return running;
  const sync = pollAttempt(product, attempt, settings, now).finally(() => inFlight.delete(attempt.id));
  inFlight.set(attempt.id, sync);
  return sync;
}

export function settledStatus(product: StoredProduct): StatusSync {
  const attempt = product.generationAttempts[0];
  if (!attempt) {
    return { httpStatus: 200, body: { status: product.status, progress: product.status === "completed" ? 100 : 0 } };
  }
  return { httpStatus: 200, body: bodyFor(attempt) };
}

async function pollAttempt(
  product: StoredProduct,
  attempt: Attempt,
  settings: SystemSettings,
  now: number
): Promise<StatusSync> {
  const completedAt = new Date(now).toISOString();
  const timedOut = now - Date.parse(attempt.createdAt) > GENERATION_TIMEOUT_MS;
  const timeOut = async (): Promise<StatusSync> => ({
    httpStatus: 200,
    body: await finishAttempt(product, attempt, {
      status: "failed",
      errorCode: "TIMEOUT",
      errorMessage: "Generation took longer than 30 minutes and was stopped.",
      completedAt,
    }),
  });

  if (!attempt.providerTaskId) {
    return timedOut ? timeOut() : { httpStatus: 200, body: { status: "processing", progress: 0 } };
  }

  let task;
  try {
    meshyClient.updateConfig(settings.meshyApiKey, settings.meshyApiBaseUrl);
    task = await meshyClient.getTaskStatus(
      attempt.providerTaskId,
      isSingleImage(product) ? "image_to_3d" : "multi_image_to_3d"
    );
  } catch (err) {
    return {
      httpStatus: 502,
      body: { status: "processing", error: err instanceof Error ? err.message : "Could not reach Meshy" },
    };
  }

  const sourceUrl = task.model_urls?.glb || task.model_url;
  if (task.status === "SUCCEEDED" && sourceUrl) {
    const modelUrl = await cacheModel(sourceUrl, product, attempt);
    return { httpStatus: 200, body: await finishAttempt(product, attempt, { status: "completed", modelUrl, completedAt }) };
  }
  if (task.status === "FAILED") {
    return {
      httpStatus: 200,
      body: await finishAttempt(product, attempt, {
        status: "failed",
        errorCode: "PROVIDER_FAILED",
        errorMessage: task.task_error?.message || "Meshy generation failed",
        completedAt,
      }),
    };
  }
  if (timedOut) return timeOut();
  return { httpStatus: 200, body: { status: "processing", progress: task.progress ?? 0 } };
}
