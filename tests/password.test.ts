import crypto from "node:crypto";
import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "../src/lib/auth/password";

describe("password hashing", () => {
  it("stores the iteration count with a strong default", () => {
    const [scheme, iterations] = hashPassword("secret12").split("$");
    expect(scheme).toBe("pbkdf2");
    expect(Number(iterations)).toBeGreaterThanOrEqual(210000);
  });

  it("verifies a freshly hashed password", () => {
    expect(verifyPassword("secret12", hashPassword("secret12"))).toBe(true);
  });

  it("rejects a wrong password", () => {
    expect(verifyPassword("wrong", hashPassword("secret12"))).toBe(false);
  });

  it("still verifies legacy salt:hash records", () => {
    const salt = "abcd";
    const legacy = `${salt}:${crypto.pbkdf2Sync("secret12", salt, 1000, 64, "sha512").toString("hex")}`;
    expect(verifyPassword("secret12", legacy)).toBe(true);
    expect(verifyPassword("nope", legacy)).toBe(false);
  });
});
