import { describe, it, expect, vi } from "vitest";

vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");

const { SupabaseStorageService } = await import("../src/lib/storage/supabase-storage");

describe("storage without Supabase", () => {
  it("keeps the merchant's own photo instead of substituting a stock image", async () => {
    const result = await new SupabaseStorageService().uploadProductImage(Buffer.from("photo"), "a.png", "p1", "front");
    expect(result.publicUrl).toBe(`data:image/png;base64,${Buffer.from("photo").toString("base64")}`);
  });
});
