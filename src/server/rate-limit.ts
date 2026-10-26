// Per-instance memory only: on serverless each instance throttles on its own
export function createFailureLimiter({ limit, windowMs }: { limit: number; windowMs: number }) {
  const failures = new Map<string, { count: number; resetAt: number }>();

  function evictExpired(now: number) {
    for (const [key, entry] of failures) {
      if (now > entry.resetAt) failures.delete(key);
    }
  }

  return {
    isBlocked(key: string, now: number = Date.now()): boolean {
      const entry = failures.get(key);
      return !!entry && now <= entry.resetAt && entry.count >= limit;
    },
    recordFailure(key: string, now: number = Date.now()): void {
      evictExpired(now);
      const entry = failures.get(key);
      if (entry) entry.count += 1;
      else failures.set(key, { count: 1, resetAt: now + windowMs });
    },
    reset(key: string): void {
      failures.delete(key);
    },
    size(): number {
      return failures.size;
    },
  };
}
