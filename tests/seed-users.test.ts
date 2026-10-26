import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mocks = vi.hoisted(() => ({ insert: vi.fn() }));

vi.mock("../src/lib/supabase/db", () => ({
  getSupabaseClient: () => ({
    from: () => ({
      select: () => ({ or: () => ({ maybeSingle: async () => ({ data: null }) }) }),
      insert: mocks.insert,
    }),
  }),
}));

import { authService } from "../src/lib/supabase/auth-service";

beforeEach(() => mocks.insert.mockReset());
afterEach(() => vi.unstubAllEnvs());

describe("ensureSeedUsers", () => {
  it("never creates the well-known demo accounts in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    await authService.ensureSeedUsers();
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("creates the demo accounts in demo mode", async () => {
    vi.stubEnv("NODE_ENV", "development");
    await authService.ensureSeedUsers();
    expect(mocks.insert).toHaveBeenCalled();
  });
});
