export const MAX_PROXY_BYTES = 60 * 1024 * 1024;

const MESHY_HOST = /^([a-z0-9-]+\.)*meshy\.ai$/;
const KHRONOS_SAMPLES_PATH = "/KhronosGroup/glTF-Sample-Models/";

function parseHttps(raw: string): URL | null {
  try {
    const url = new URL(raw);
    return url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

export function isAllowedModelUrl(
  raw: string,
  supabaseUrl: string | undefined = process.env.NEXT_PUBLIC_SUPABASE_URL
): boolean {
  const url = parseHttps(raw);
  if (!url) return false;
  if (url.hostname === "assets.meshy.ai") return true;
  if (url.hostname === "raw.githubusercontent.com" && url.pathname.startsWith(KHRONOS_SAMPLES_PATH)) return true;
  const supabaseHost = supabaseUrl ? parseHttps(supabaseUrl)?.hostname : undefined;
  return !!supabaseHost && url.hostname === supabaseHost;
}

export function isAllowedMeshyBaseUrl(raw: string): boolean {
  const url = parseHttps(raw);
  return !!url && MESHY_HOST.test(url.hostname);
}

export async function readBodyWithLimit(res: Response, maxBytes: number): Promise<Uint8Array<ArrayBuffer> | null> {
  if (!res.body) return new Uint8Array(0);
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

export const MASK_PREFIX = "••••";

export function maskSecret(secret: string): string {
  if (!secret) return "";
  return secret.length > 8 ? `${MASK_PREFIX}${secret.slice(-4)}` : MASK_PREFIX;
}
