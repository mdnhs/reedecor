import { describe, it, expect } from "vitest";
import { canManageProduct, isDemoMode, isStaff, PUBLIC_REGISTRATION_ROLES } from "../src/server/access";
import type { AppUser, UserRole } from "../src/lib/supabase/auth-service";

function user(id: string, role: UserRole): AppUser {
  return {
    id,
    email: `${id}@x.test`,
    name: id,
    role,
    status: "active",
    plan: "free",
    createdAt: "2026-10-26T00:00:00Z",
    updatedAt: "2026-10-26T00:00:00Z",
  };
}

const product = { merchantId: "m-owner" };

describe("isDemoMode", () => {
  it("is off in production without the flag", () => {
    expect(isDemoMode({ NODE_ENV: "production" } as NodeJS.ProcessEnv)).toBe(false);
  });

  it("is on in production when DEMO_MODE is true", () => {
    expect(isDemoMode({ NODE_ENV: "production", DEMO_MODE: "true" } as NodeJS.ProcessEnv)).toBe(true);
  });

  it("is on during development", () => {
    expect(isDemoMode({ NODE_ENV: "development" } as NodeJS.ProcessEnv)).toBe(true);
  });
});

describe("canManageProduct", () => {
  it("allows the owning merchant", () => {
    expect(canManageProduct(user("m-owner", "merchant"), product)).toBe(true);
  });

  it("allows an admin", () => {
    expect(canManageProduct(user("admin-1", "saas_admin"), product)).toBe(true);
  });

  it("rejects another merchant", () => {
    expect(canManageProduct(user("m-other", "merchant"), product)).toBe(false);
  });

  it("rejects a customer even with a matching id", () => {
    expect(canManageProduct(user("m-owner", "customer"), product)).toBe(false);
  });

  it("rejects a signed-out request", () => {
    expect(canManageProduct(null, product)).toBe(false);
  });
});

describe("isStaff", () => {
  it("accepts merchants and admins only", () => {
    expect(isStaff(user("a", "merchant"))).toBe(true);
    expect(isStaff(user("b", "saas_admin"))).toBe(true);
    expect(isStaff(user("c", "customer"))).toBe(false);
    expect(isStaff(null)).toBe(false);
  });
});

describe("PUBLIC_REGISTRATION_ROLES", () => {
  it("never includes the admin role", () => {
    expect(PUBLIC_REGISTRATION_ROLES).toEqual(["merchant", "customer"]);
  });
});
