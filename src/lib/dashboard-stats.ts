import type { StoredProduct } from "@/server/demo-store";

export interface DashboardStats {
  total: number;
  completed: number;
  processing: number;
  failed: number;
  attempts: number;
  successRate: number | null;
}

export function computeStats(products: StoredProduct[]): DashboardStats {
  const attempts = products.flatMap((p) => p.generationAttempts);
  const finished = attempts.filter(
    (a) => a.status === "completed" || (a.status === "failed" && a.errorCode !== "CANCELLED_BY_USER")
  );
  const succeeded = finished.filter((a) => a.status === "completed").length;
  return {
    total: products.length,
    completed: products.filter((p) => p.status === "completed").length,
    processing: products.filter((p) => p.status === "processing" || p.status === "queued").length,
    failed: products.filter((p) => p.status === "failed").length,
    attempts: attempts.length,
    successRate: finished.length ? Math.round((succeeded / finished.length) * 1000) / 10 : null,
  };
}

export interface DayBucket {
  date: string;
  completed: number;
  failed: number;
}

const DAY_MS = 86_400_000;

function localDate(timestamp: number, utcOffsetMinutes: number): string {
  return new Date(timestamp + utcOffsetMinutes * 60_000).toISOString().slice(0, 10);
}

export function attemptsByDay(
  products: StoredProduct[],
  days: number,
  now: number = Date.now(),
  utcOffsetMinutes: number = -new Date(now).getTimezoneOffset()
): DayBucket[] {
  const buckets: DayBucket[] = Array.from({ length: days }, (_, i) => ({
    date: localDate(now - (days - 1 - i) * DAY_MS, utcOffsetMinutes),
    completed: 0,
    failed: 0,
  }));
  const byDate = new Map(buckets.map((b) => [b.date, b]));
  for (const attempt of products.flatMap((p) => p.generationAttempts)) {
    const bucket = byDate.get(localDate(Date.parse(attempt.createdAt), utcOffsetMinutes));
    if (!bucket) continue;
    if (attempt.status === "completed") bucket.completed += 1;
    else if (attempt.status === "failed" && attempt.errorCode !== "CANCELLED_BY_USER") bucket.failed += 1;
  }
  return buckets;
}
