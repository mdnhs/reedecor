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

describe("optimizeGlbBuffer provenance", () => {
  async function meshyGlb() {
    const { Document, NodeIO } = await import("@gltf-transform/core");
    const doc = new Document();
    doc.getRoot().getAsset().generator = "Meshy AI";
    doc.createBuffer();
    doc.createScene("s").addChild(doc.createNode("n"));
    return Buffer.from(await new NodeIO().writeBinary(doc));
  }

  async function assetOf(glb: Buffer) {
    const { NodeIO } = await import("@gltf-transform/core");
    const json = await new NodeIO().binaryToJSON(new Uint8Array(glb));
    return json.json.asset;
  }

  it("marks the model as AI-generated and keeps the original generator", async () => {
    const output = await optimizeGlbBuffer(await meshyGlb(), {
      enableDraco: false,
      strict: true,
      provenance: { aiGenerated: true, provider: "meshy", taskId: "task-9" },
    });
    const asset = await assetOf(output);
    expect(asset.extras).toMatchObject({
      provenance: { aiGenerated: true, provider: "meshy", taskId: "task-9", sourceGenerator: "Meshy AI" },
    });
  });
});
