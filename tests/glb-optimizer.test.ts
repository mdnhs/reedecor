import { describe, it, expect, vi } from "vitest";
import { optimizeGlbBuffer } from "../src/lib/storage/glb-optimizer";

function corruptGlb() {
  const bytes = Buffer.alloc(32);
  bytes.write("glTF", 0, "ascii");
  bytes.writeUInt32LE(2, 4);
  bytes.writeUInt32LE(bytes.length, 8);
  return bytes;
}

describe("optimizeGlbBuffer", () => {
  it("throws in strict mode when the GLB body cannot be parsed", async () => {
    await expect(optimizeGlbBuffer(corruptGlb(), { strict: true })).rejects.toThrow();
  });

  it("falls back to the original buffer when not strict", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const input = corruptGlb();
    const output = await optimizeGlbBuffer(input);
    expect(output.equals(input)).toBe(true);
  });
});
