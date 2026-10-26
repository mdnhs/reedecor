import { describe, it, expect, vi } from "vitest";

vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
vi.stubEnv("MESHY_API_KEY", "");

const { supabaseDb } = await import("../src/lib/supabase/db");

describe("system settings fallback", () => {
  it("reports no Meshy key instead of a placeholder that looks configured", async () => {
    expect((await supabaseDb.getSystemSettings()).meshyApiKey).toBe("");
  });
});
