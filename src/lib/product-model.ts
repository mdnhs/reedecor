import type { StoredProduct } from "@/server/demo-store";

type Attempt = StoredProduct["generationAttempts"][number];

export function latestModelAttempt(product: Pick<StoredProduct, "generationAttempts">): Attempt | null {
  return product.generationAttempts.find((a) => a.status === "completed" && a.modelUrl) ?? null;
}

export function isSimulatedAttempt(attempt: Pick<Attempt, "providerTaskId">): boolean {
  return !!attempt.providerTaskId?.startsWith("mock-task");
}
