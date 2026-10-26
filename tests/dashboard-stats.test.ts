import { describe, it, expect } from "vitest";
import { attemptsByDay, computeStats } from "../src/lib/dashboard-stats";
import type { StoredProduct } from "../src/server/demo-store";

type Attempt = StoredProduct["generationAttempts"][number];

function attempt(status: Attempt["status"], createdAt: string, errorCode: string | null = null): Attempt {
  return { id: `${status}-${createdAt}`, provider: "meshy", status, creditCostEstimate: 20, createdAt, errorCode };
}

function product(status: StoredProduct["status"], attempts: Attempt[]): StoredProduct {
  return {
    id: Math.random().toString(),
    merchantId: "m",
    name: "p",
    category: "Chair",
    widthMm: 1,
    depthMm: 1,
    heightMm: 1,
    priceBdt: 0,
    status,
    createdAt: "2026-10-01T00:00:00Z",
    updatedAt: "2026-10-01T00:00:00Z",
    images: [],
    generationAttempts: attempts,
  };
}

describe("computeStats", () => {
  it("reports no success rate when nothing has finished", () => {
    expect(computeStats([]).successRate).toBeNull();
    expect(computeStats([product("processing", [attempt("processing", "2026-10-25T00:00:00Z")])]).successRate).toBeNull();
  });

  it("measures success over finished attempts, ignoring user cancels", () => {
    const stats = computeStats([
      product("completed", [attempt("completed", "2026-10-25T00:00:00Z"), attempt("failed", "2026-10-24T00:00:00Z")]),
      product("failed", [attempt("failed", "2026-10-23T00:00:00Z", "CANCELLED_BY_USER")]),
      product("processing", [attempt("processing", "2026-10-26T00:00:00Z")]),
    ]);
    expect(stats).toMatchObject({ total: 3, completed: 1, processing: 1, failed: 1, attempts: 4, successRate: 50 });
  });
});

describe("attemptsByDay", () => {
  it("buckets finished attempts per day for the requested window", () => {
    const now = Date.parse("2026-10-26T12:00:00Z");
    const days = attemptsByDay(
      [
        product("completed", [
          attempt("completed", "2026-10-26T08:00:00Z"),
          attempt("failed", "2026-10-25T08:00:00Z"),
          attempt("completed", "2026-09-01T08:00:00Z"),
        ]),
      ],
      3,
      now,
      0
    );
    expect(days).toEqual([
      { date: "2026-10-24", completed: 0, failed: 0 },
      { date: "2026-10-25", completed: 0, failed: 1 },
      { date: "2026-10-26", completed: 1, failed: 0 },
    ]);
  });
});

describe("attemptsByDay edge cases", () => {
  it("does not count user cancels as failures", () => {
    const now = Date.parse("2026-10-26T12:00:00Z");
    const [day] = attemptsByDay(
      [product("failed", [attempt("failed", "2026-10-26T08:00:00Z", "CANCELLED_BY_USER")])],
      1,
      now,
      0
    );
    expect(day).toEqual({ date: "2026-10-26", completed: 0, failed: 0 });
  });

  it("buckets by the viewer's local day", () => {
    const now = Date.parse("2026-10-25T21:00:00Z");
    const days = attemptsByDay(
      [product("completed", [attempt("completed", "2026-10-25T20:00:00Z")])],
      2,
      now,
      360
    );
    expect(days).toEqual([
      { date: "2026-10-25", completed: 0, failed: 0 },
      { date: "2026-10-26", completed: 1, failed: 0 },
    ]);
  });
});
