import { describe, it, expect } from "vitest";
import { isAllowedMeshyBaseUrl, isAllowedModelUrl, maskSecret } from "../src/server/proxy-allowlist";

const SUPABASE = "https://project.supabase.co";

describe("isAllowedModelUrl", () => {
  it("allows Meshy asset URLs over https", () => {
    expect(isAllowedModelUrl("https://assets.meshy.ai/tasks/a/model.glb", SUPABASE)).toBe(true);
  });

  it("allows our own Supabase storage host", () => {
    expect(isAllowedModelUrl("https://project.supabase.co/storage/v1/object/public/b/m.glb", SUPABASE)).toBe(true);
  });

  it("rejects cloud metadata and internal addresses", () => {
    expect(isAllowedModelUrl("http://169.254.169.254/latest/meta-data", SUPABASE)).toBe(false);
    expect(isAllowedModelUrl("https://localhost/x.glb", SUPABASE)).toBe(false);
  });

  it("rejects other hosts and plain http", () => {
    expect(isAllowedModelUrl("https://evil.com/x.glb", SUPABASE)).toBe(false);
    expect(isAllowedModelUrl("http://assets.meshy.ai/x.glb", SUPABASE)).toBe(false);
    expect(isAllowedModelUrl("https://assets.meshy.ai.evil.com/x.glb", SUPABASE)).toBe(false);
  });

  it("allows the public Khronos sample models used by demo data", () => {
    const sample = "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/SheenChair/glTF-Binary/SheenChair.glb";
    expect(isAllowedModelUrl(sample, SUPABASE)).toBe(true);
    expect(isAllowedModelUrl("https://raw.githubusercontent.com/attacker/repo/main/x.glb", SUPABASE)).toBe(false);
  });

  it("rejects malformed URLs", () => {
    expect(isAllowedModelUrl("not a url", SUPABASE)).toBe(false);
  });
});

describe("isAllowedMeshyBaseUrl", () => {
  it("accepts Meshy hosts only", () => {
    expect(isAllowedMeshyBaseUrl("https://api.meshy.ai")).toBe(true);
    expect(isAllowedMeshyBaseUrl("https://evil.com")).toBe(false);
    expect(isAllowedMeshyBaseUrl("https://api.meshy.ai.evil.com")).toBe(false);
  });
});

describe("maskSecret", () => {
  it("keeps only the last four characters", () => {
    expect(maskSecret("msy_abcdef1234")).toBe("••••1234");
  });

  it("hides a short secret entirely", () => {
    expect(maskSecret("abcd")).toBe("••••");
  });

  it("leaves an empty secret empty", () => {
    expect(maskSecret("")).toBe("");
  });
});
