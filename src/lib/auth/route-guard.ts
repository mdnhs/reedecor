const PUBLIC_EXACT = ["/login", "/store", "/viewer"];
const PUBLIC_PREFIXES = ["/store/", "/viewer/"];

export function isPublicPath(pathname: string): boolean {
  if (PUBLIC_EXACT.includes(pathname)) return true;
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export function safeNextPath(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || /[\\\s\x00-\x1f]/.test(raw)) return "/";
  return raw;
}
