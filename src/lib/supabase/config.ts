export function resolveSupabaseConfig(env: NodeJS.ProcessEnv = process.env): { url: string; key: string } | null {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) return null;
  if (serviceKey) return { url, key: serviceKey };

  if (env.NODE_ENV === "production") {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY must be set in production; the public key cannot be used server-side.");
  }
  const publicKey = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return publicKey ? { url, key: publicKey } : null;
}
