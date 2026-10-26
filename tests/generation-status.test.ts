import { describe, it, expect, vi, beforeEach } from "vitest";
import type { StoredProduct } from "../src/server/demo-store";
import type { SystemSettings } from "../src/lib/supabase/db";

const mocks = vi.hoisted(() => ({
  meshy: { updateConfig: vi.fn(), isConfigured: vi.fn(), getTaskStatus: vi.fn() },
  db: { updateGenerationAttempt: vi.fn(), updateProductStatus: vi.fn(), getProductById: vi.fn() },
  memory: { update: vi.fn() },
  storage: { uploadModelFile: vi.fn() },
}));

vi.mock("@/lib/meshy/client", () => ({ meshyClient: mocks.meshy }));
vi.mock("@/lib/supabase/db", () => ({ supabaseDb: mocks.db }));
vi.mock("@/server/demo-store", () => ({ inMemoryStore: mocks.memory }));
vi.mock("@/lib/storage/supabase-storage", () => ({ storageService: mocks.storage }));

import { GENERATION_TIMEOUT_MS, syncGenerationStatus } from "../src/server/generation";

type Attempt = StoredProduct["generationAttempts"][number];
const settings = { meshyApiKey: "k", meshyApiBaseUrl: "https://api.meshy.ai" } as SystemSettings;
const NOW = Date.parse("2026-10-26T12:00:00Z");

function attempt(overrides: Partial<Attempt> = {}): Attempt {
  return {
    id: "g2",
    provider: "meshy",
    providerTaskId: "task-2",
    status: "processing",
    modelUrl: null,
    creditCostEstimate: 20,
    createdAt: new Date(NOW - 60_000).toISOString(),
    ...overrides,
  };
}

function product(attempts: Attempt[], status: StoredProduct["status"] = "processing"): StoredProduct {
  return {
    id: "p1",
    merchantId: "m1",
    name: "Chair",
    category: "Chair",
    widthMm: 1,
    depthMm: 1,
    heightMm: 1,
    priceBdt: 0,
    status,
    generationMode: "multi_image_to_3d",
    createdAt: "2026-10-26T00:00:00Z",
    updatedAt: "2026-10-26T00:00:00Z",
    images: [],
    generationAttempts: attempts,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.db.updateGenerationAttempt.mockResolvedValue(true);
  mocks.db.updateProductStatus.mockResolvedValue(undefined);
  vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("nope", { status: 500 }));
});

describe("syncGenerationStatus", () => {
  it("keeps a model Meshy finished even when the poll arrives after the timeout", async () => {
    mocks.meshy.getTaskStatus.mockResolvedValue({ status: "SUCCEEDED", model_urls: { glb: "https://assets.meshy.ai/m.glb" } });
    const stale = attempt({ createdAt: new Date(NOW - GENERATION_TIMEOUT_MS - 1000).toISOString() });
    const result = await syncGenerationStatus(product([stale]), settings, NOW);
    expect(result.body.status).toBe("completed");
  });

  it("fails a processing attempt that has run past the timeout", async () => {
    mocks.meshy.getTaskStatus.mockResolvedValue({ status: "IN_PROGRESS", progress: 40 });
    const stale = attempt({ createdAt: new Date(NOW - GENERATION_TIMEOUT_MS - 1000).toISOString() });
    const result = await syncGenerationStatus(product([stale]), settings, NOW);
    expect(result.body.status).toBe("failed");
    expect(mocks.db.updateGenerationAttempt).toHaveBeenCalledWith(
      "g2",
      expect.objectContaining({ status: "failed", errorCode: "TIMEOUT" }),
      "processing"
    );
  });

  it("does not overwrite an attempt that was cancelled while the poll was running", async () => {
    mocks.meshy.getTaskStatus.mockResolvedValue({ status: "SUCCEEDED", model_urls: { glb: "https://assets.meshy.ai/m.glb" } });
    mocks.db.updateGenerationAttempt.mockResolvedValue(false);
    mocks.db.getProductById.mockResolvedValue(
      product([attempt({ status: "failed", errorCode: "CANCELLED_BY_USER", errorMessage: "Generation was cancelled by the user." })], "failed")
    );
    const result = await syncGenerationStatus(product([attempt()]), settings, NOW);
    expect(result.body).toMatchObject({ status: "failed", errorMessage: "Generation was cancelled by the user." });
    expect(mocks.db.updateProductStatus).not.toHaveBeenCalledWith("p1", "completed");
  });

  it("reports the stored result when another poll already finished the attempt", async () => {
    mocks.meshy.getTaskStatus.mockResolvedValue({ status: "SUCCEEDED", model_urls: { glb: "https://assets.meshy.ai/m.glb" } });
    mocks.db.updateGenerationAttempt.mockResolvedValue(false);
    mocks.db.getProductById.mockResolvedValue(
      product([attempt({ status: "completed", modelUrl: "https://cdn/done.glb" })], "completed")
    );
    const result = await syncGenerationStatus(product([attempt()]), settings, NOW);
    expect(result.body).toMatchObject({ status: "completed", modelUrl: "https://cdn/done.glb" });
  });

  it("shares one in-flight sync between overlapping polls of the same attempt", async () => {
    let release!: (v: unknown) => void;
    mocks.meshy.getTaskStatus.mockReturnValue(new Promise((r) => (release = r)));
    const first = syncGenerationStatus(product([attempt()]), settings, NOW);
    const second = syncGenerationStatus(product([attempt()]), settings, NOW);
    release({ status: "IN_PROGRESS", progress: 50 });
    await Promise.all([first, second]);
    expect(mocks.meshy.getTaskStatus).toHaveBeenCalledTimes(1);
  });

  it("keeps the earlier model when a retry fails", async () => {
    mocks.meshy.getTaskStatus.mockResolvedValue({ status: "FAILED", task_error: { message: "bad photos" } });
    const done = attempt({ id: "g1", status: "completed", modelUrl: "https://cdn/m1.glb" });
    await syncGenerationStatus(product([attempt(), done]), settings, NOW);
    expect(mocks.db.updateProductStatus).toHaveBeenCalledWith("p1", "completed");
  });

  it("marks the product failed when its only attempt fails", async () => {
    mocks.meshy.getTaskStatus.mockResolvedValue({ status: "FAILED", task_error: { message: "bad photos" } });
    const result = await syncGenerationStatus(product([attempt()]), settings, NOW);
    expect(result.body).toMatchObject({ status: "failed", errorMessage: "bad photos" });
    expect(mocks.db.updateProductStatus).toHaveBeenCalledWith("p1", "failed");
  });

  it("reports a polling error instead of inventing progress", async () => {
    mocks.meshy.getTaskStatus.mockRejectedValue(new Error("meshy unreachable"));
    const result = await syncGenerationStatus(product([attempt()]), settings, NOW);
    expect(result.httpStatus).toBe(502);
    expect(result.body).toMatchObject({ status: "processing", error: "meshy unreachable" });
    expect(result.body).not.toHaveProperty("progress");
  });

  it("stores each successful model under its own attempt path", async () => {
    mocks.meshy.getTaskStatus.mockResolvedValue({ status: "SUCCEEDED", model_urls: { glb: "https://assets.meshy.ai/m.glb" } });
    vi.mocked(globalThis.fetch).mockResolvedValue(new Response(new Uint8Array([1, 2, 3]), { status: 200 }));
    mocks.storage.uploadModelFile.mockResolvedValue({ publicUrl: "https://cdn/models/p1/g2.glb" });
    const result = await syncGenerationStatus(product([attempt()]), settings, NOW);
    expect(mocks.storage.uploadModelFile).toHaveBeenCalledWith(expect.anything(), "g2.glb", "p1");
    expect(result.body).toMatchObject({ status: "completed", modelUrl: "https://cdn/models/p1/g2.glb" });
  });
});
