export async function assetFetch<T = unknown>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const json = await res.json().catch(() => null);
  if (!json?.success) throw new Error(json?.error || "Request failed");
  return json.data as T;
}

export function errorText(err: unknown): string {
  return err instanceof Error ? err.message : "Something went wrong";
}

export interface MerchantOption {
  id: string;
  name: string;
}
