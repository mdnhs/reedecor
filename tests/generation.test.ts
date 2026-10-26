import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { StoredProduct } from "../src/server/demo-store";
import type { SystemSettings } from "../src/lib/supabase/db";

const mocks = vi.hoisted(() => ({
  meshy: {
    isConfigured: vi.fn(),
    updateConfig: vi.fn(),
    createImageTo3dTask: vi.fn(),
    createMultiImageTask: vi.fn(),
  },
  db: {
    addGenerationAttempt: vi.fn(),
    updateProductStatus: vi.fn(),
    updateGenerationAttempt: vi.fn(),
  },
  memory: { update: vi.fn() },
}));

vi.mock("@/lib/meshy/client", () => ({ meshyClient: mocks.meshy }));
vi.mock("@/lib/supabase/db", () => ({ supabaseDb: mocks.db }));
vi.mock("@/server/demo-store", () => ({ inMemoryStore: mocks.memory }));

import { creditCost, creditsUsed, startGeneration, DEFAULT_CREDIT_ALLOWANCE } from "../src/server/generation";

type Attempt = StoredProduct["generationAttempts"][number];

const settings = {
  meshyApiKey: "msy_key",
  meshyApiBaseUrl: "https://api.meshy.ai",
  meshyModel: "meshy-7.1",
  meshyGeometryResolution: "standard",
  meshyTextureResolution: "2k",
  meshyCreditsPerGeneration: 20,
} as SystemSettings;

function attempt(overrides: Partial<Attempt>): Attempt {
  return {
    id: "a",
    provider: "meshy",
    providerTaskId: "t",
    status: "completed",
    modelUrl: null,
    creditCostEstimate: 20,
    createdAt: "2026-10-26T00:00:00Z",
    ...overrides,
  };
}

function product(overrides: Partial<StoredProduct> = {}): StoredProduct {
  const image = (viewType: "front" | "back" | "left" | "right") => ({
    id: viewType,
    viewType,
    publicUrl: `https://cdn/${viewType}.jpg`,
    storagePath: `p/${viewType}.jpg`,
    fileName: `${viewType}.jpg`,
    mimeType: "image/jpeg",
    fileSizeBytes: 1,
  });
  return {
    id: "p1",
    merchantId: "m1",
    name: "Chair",
    category: "Chair",
    widthMm: 1,
    depthMm: 1,
    heightMm: 1,
    priceBdt: 0,
    status: "draft",
    generationMode: "multi_image_to_3d",
    createdAt: "2026-10-26T00:00:00Z",
    updatedAt: "2026-10-26T00:00:00Z",
    images: [image("front"), image("back"), image("left"), image("right")],
    generationAttempts: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.meshy.isConfigured.mockReturnValue(true);
  mocks.meshy.createMultiImageTask.mockResolvedValue({ taskId: "task-1", isMock: false });
  mocks.meshy.createImageTo3dTask.mockResolvedValue({ taskId: "task-2", isMock: false });
  mocks.db.addGenerationAttempt.mockResolvedValue(undefined);
  mocks.db.updateProductStatus.mockResolvedValue(undefined);
  mocks.db.updateGenerationAttempt.mockResolvedValue(true);
});

afterEach(() => vi.unstubAllEnvs());

describe("creditCost", () => {
  it("charges 10 for a single image and the configured amount for multi-image", () => {
    expect(creditCost(product({ generationMode: "image_to_3d", images: product().images.slice(0, 1) }), settings)).toBe(10);
    expect(creditCost(product(), settings)).toBe(20);
  });
});

describe("creditsUsed", () => {
  it("charges a cancel once the Meshy task exists", () => {
    const products = [
      product({
        generationAttempts: [attempt({ status: "failed", errorCode: "CANCELLED_BY_USER", providerTaskId: "t1", creditCostEstimate: 20 })],
      }),
    ];
    expect(creditsUsed(products)).toBe(20);
  });

  it("counts charged attempts but not cancelled, unstarted or timed-out ones", () => {
    const products = [
      product({
        generationAttempts: [
          attempt({ status: "completed", creditCostEstimate: 20 }),
          attempt({ status: "processing", creditCostEstimate: 10 }),
          attempt({ status: "failed", errorCode: "PROVIDER_FAILED", creditCostEstimate: 20 }),
          attempt({ status: "failed", errorCode: "CANCELLED_BY_USER", providerTaskId: null, creditCostEstimate: 20 }),
          attempt({ status: "failed", errorCode: "GENERATION_INIT_FAILED", creditCostEstimate: 20 }),
          attempt({ status: "failed", errorCode: "TIMEOUT", creditCostEstimate: 20 }),
        ],
      }),
    ];
    expect(creditsUsed(products)).toBe(50);
  });
});

describe("startGeneration", () => {
  it("refuses a second generation while one is processing", async () => {
    const busy = product({ generationAttempts: [attempt({ status: "processing" })] });
    const result = await startGeneration(busy, settings, 0, "gen-1");
    expect(result.status).toBe(409);
    expect(mocks.meshy.createMultiImageTask).not.toHaveBeenCalled();
  });

  it("refuses when the merchant has no credits left", async () => {
    const result = await startGeneration(product(), settings, DEFAULT_CREDIT_ALLOWANCE - 5, "gen-1");
    expect(result.status).toBe(402);
    expect(mocks.meshy.createMultiImageTask).not.toHaveBeenCalled();
  });

  it("refuses to simulate in production when Meshy is not configured", async () => {
    vi.stubEnv("NODE_ENV", "production");
    mocks.meshy.isConfigured.mockReturnValue(false);
    const result = await startGeneration(product(), settings, 0, "gen-1");
    expect(result.status).toBe(503);
    expect(mocks.meshy.createMultiImageTask).not.toHaveBeenCalled();
  });

  it("rejects multi-image generation without all four views", async () => {
    const result = await startGeneration(product({ images: product().images.slice(0, 3) }), settings, 0, "gen-1");
    expect(result.status).toBe(400);
  });

  it("claims a queued slot before calling Meshy, then records the task id", async () => {
    const order: string[] = [];
    mocks.db.addGenerationAttempt.mockImplementation(async (_id: string, a: { status: string }) => {
      order.push(`insert:${a.status}`);
    });
    mocks.meshy.createMultiImageTask.mockImplementation(async () => {
      order.push("meshy");
      return { taskId: "task-1", isMock: false };
    });
    const result = await startGeneration(product(), settings, 0, "gen-1");
    expect(result.status).toBe(200);
    expect(order).toEqual(["insert:queued", "meshy"]);
    expect(mocks.db.updateGenerationAttempt).toHaveBeenCalledWith(
      "gen-1",
      expect.objectContaining({ providerTaskId: "task-1", status: "processing" }),
      "queued"
    );
    expect(mocks.db.updateProductStatus).toHaveBeenCalledWith("p1", "processing");
  });

  it("returns 409 without calling Meshy when another request already claimed the slot", async () => {
    mocks.db.addGenerationAttempt.mockRejectedValueOnce(
      new Error('duplicate key value violates unique constraint "generation_attempts_one_active"')
    );
    const result = await startGeneration(product(), settings, 0, "gen-1");
    expect(result.status).toBe(409);
    expect(mocks.meshy.createMultiImageTask).not.toHaveBeenCalled();
  });

  it("reports the paid task id when it cannot be saved after Meshy accepted it", async () => {
    mocks.db.updateGenerationAttempt.mockRejectedValueOnce(new Error("db down"));
    const result = await startGeneration(product(), settings, 0, "gen-1");
    expect(result.status).toBe(500);
    expect("error" in result && result.error).toContain("task-1");
  });

  it("returns a 500 even when recording the provider failure also fails", async () => {
    mocks.meshy.createMultiImageTask.mockRejectedValueOnce(new Error("meshy down"));
    mocks.db.updateGenerationAttempt.mockRejectedValueOnce(new Error("db down"));
    const result = await startGeneration(product(), settings, 0, "gen-1");
    expect(result.status).toBe(500);
    expect("error" in result && result.error).toContain("meshy down");
  });
});
