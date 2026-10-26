import { describe, it, expect } from "vitest";
import { isPublicPath, safeNextPath } from "../src/lib/auth/route-guard";

describe("isPublicPath", () => {
  it("keeps the login page, storefronts and the 3D viewer public", () => {
    expect(isPublicPath("/login")).toBe(true);
    expect(isPublicPath("/store/m-1")).toBe(true);
    expect(isPublicPath("/viewer/p-1")).toBe(true);
  });

  it("protects the dashboard and admin pages", () => {
    expect(isPublicPath("/")).toBe(false);
    expect(isPublicPath("/products")).toBe(false);
    expect(isPublicPath("/admin/rbac")).toBe(false);
    expect(isPublicPath("/loginx")).toBe(false);
  });
});

describe("safeNextPath", () => {
  it("returns an in-app path unchanged", () => {
    expect(safeNextPath("/products?tab=1")).toBe("/products?tab=1");
  });

  it("refuses off-site redirects", () => {
    expect(safeNextPath("//evil.com")).toBe("/");
    expect(safeNextPath("https://evil.com")).toBe("/");
    expect(safeNextPath("/\\evil.com")).toBe("/");
    expect(safeNextPath("/\t/evil.com")).toBe("/");
    expect(safeNextPath("/\n/evil.com")).toBe("/");
  });

  it("falls back to home when missing", () => {
    expect(safeNextPath(null)).toBe("/");
  });
});
