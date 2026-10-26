import crypto from "node:crypto";

const ITERATIONS = 210000;
const LEGACY_ITERATIONS = 1000;

function derive(password: string, salt: string, iterations: number): string {
  return crypto.pbkdf2Sync(password, salt, iterations, 64, "sha512").toString("hex");
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  return `pbkdf2$${ITERATIONS}$${salt}$${derive(password, salt, ITERATIONS)}`;
}

// Accepts the current "pbkdf2$iterations$salt$hash" format and legacy "salt:hash" records
export function verifyPassword(password: string, stored: string): boolean {
  try {
    const parts = stored.startsWith("pbkdf2$") ? stored.split("$").slice(1) : [String(LEGACY_ITERATIONS), ...stored.split(":")];
    const [iterations, salt, key] = parts;
    if (!salt || !key || !Number(iterations)) return false;
    const hash = derive(password, salt, Number(iterations));
    return crypto.timingSafeEqual(Buffer.from(key, "hex"), Buffer.from(hash, "hex"));
  } catch {
    return false;
  }
}
