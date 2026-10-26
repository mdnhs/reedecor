import { describe, it, expect } from "vitest";
import { resolveSupabaseConfig } from "../src/lib/supabase/config";

const env = (vars: Record<string, string>) => vars as unknown as NodeJS.ProcessEnv;

describe("resolveSupabaseConfig", () => {
  it("uses the service role key when present", () => {
    expect(
      resolveSupabaseConfig(env({ NEXT_PUBLIC_SUPABASE_URL: "https://p.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "svc" }))
    ).toEqual({ url: "https://p.supabase.co", key: "svc" });
  });

  it("refuses to fall back to the public key in production", () => {
    expect(() =>
      resolveSupabaseConfig(
        env({ NODE_ENV: "production", NEXT_PUBLIC_SUPABASE_URL: "https://p.supabase.co", NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon" })
      )
    ).toThrow(/SUPABASE_SERVICE_ROLE_KEY/);
  });

  it("allows the public key during local development", () => {
    expect(
      resolveSupabaseConfig(
        env({ NODE_ENV: "development", NEXT_PUBLIC_SUPABASE_URL: "https://p.supabase.co", NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon" })
      )
    ).toEqual({ url: "https://p.supabase.co", key: "anon" });
  });

  it("returns null without a project URL instead of guessing one", () => {
    expect(resolveSupabaseConfig(env({ SUPABASE_SERVICE_ROLE_KEY: "svc" }))).toBeNull();
  });
});
