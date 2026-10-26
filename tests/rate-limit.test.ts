import { describe, it, expect } from "vitest";
import { createFailureLimiter } from "../src/server/rate-limit";

describe("createFailureLimiter", () => {
  it("blocks after the allowed number of failures", () => {
    const limiter = createFailureLimiter({ limit: 2, windowMs: 1000 });
    limiter.recordFailure("k", 0);
    expect(limiter.isBlocked("k", 1)).toBe(false);
    limiter.recordFailure("k", 2);
    expect(limiter.isBlocked("k", 3)).toBe(true);
  });

  it("tracks keys independently", () => {
    const limiter = createFailureLimiter({ limit: 1, windowMs: 1000 });
    limiter.recordFailure("a", 0);
    expect(limiter.isBlocked("b", 0)).toBe(false);
  });

  it("unblocks once the window passes", () => {
    const limiter = createFailureLimiter({ limit: 1, windowMs: 1000 });
    limiter.recordFailure("k", 0);
    expect(limiter.isBlocked("k", 500)).toBe(true);
    expect(limiter.isBlocked("k", 1001)).toBe(false);
  });

  it("clears the count after a success", () => {
    const limiter = createFailureLimiter({ limit: 1, windowMs: 1000 });
    limiter.recordFailure("k", 0);
    limiter.reset("k");
    expect(limiter.isBlocked("k", 1)).toBe(false);
  });

  it("forgets expired keys", () => {
    const limiter = createFailureLimiter({ limit: 5, windowMs: 1000 });
    for (let i = 0; i < 100; i++) limiter.recordFailure(`k${i}`, 0);
    limiter.recordFailure("fresh", 5000);
    expect(limiter.size()).toBe(1);
  });
});
