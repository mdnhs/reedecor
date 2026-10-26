import { describe, it, expect } from "vitest";
import { isSimulatedAttempt, latestModelAttempt } from "../src/lib/product-model";

const base = { provider: "meshy", creditCostEstimate: 20, createdAt: "2026-10-26T00:00:00Z" };

describe("latestModelAttempt", () => {
  it("skips a failed retry and returns the newest finished model", () => {
    const attempt = latestModelAttempt({
      generationAttempts: [
        { ...base, id: "g3", status: "failed", modelUrl: null },
        { ...base, id: "g2", status: "completed", modelUrl: "https://cdn/g2.glb" },
        { ...base, id: "g1", status: "completed", modelUrl: "https://cdn/g1.glb" },
      ],
    });
    expect(attempt?.id).toBe("g2");
  });

  it("returns null when no model has been produced", () => {
    expect(latestModelAttempt({ generationAttempts: [{ ...base, id: "g1", status: "processing", modelUrl: null }] })).toBeNull();
  });
});

describe("isSimulatedAttempt", () => {
  it("flags attempts created by the offline simulator", () => {
    expect(isSimulatedAttempt({ providerTaskId: "mock-task-123" })).toBe(true);
    expect(isSimulatedAttempt({ providerTaskId: "018f-real" })).toBe(false);
  });
});
