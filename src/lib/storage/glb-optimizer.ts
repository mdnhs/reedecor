import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, prune, weld, draco } from "@gltf-transform/functions";
import draco3d from "draco3d";

export interface GlbOptimizeOptions {
  enableDraco?: boolean;
  strict?: boolean;
}

let ioPromise: Promise<NodeIO> | null = null;

async function getOptimizerIO(): Promise<NodeIO> {
  if (!ioPromise) {
    ioPromise = (async () => {
      const decoder = await draco3d.createDecoderModule();
      const encoder = await draco3d.createEncoderModule();
      return new NodeIO()
        .registerExtensions(ALL_EXTENSIONS)
        .registerDependencies({
          "draco3d.decoder": decoder,
          "draco3d.encoder": encoder,
        });
    })();
  }
  return ioPromise;
}

/**
 * Optimizes and compresses a raw GLB buffer:
 * 1. Deduplicates meshes, materials, textures (dedup)
 * 2. Prunes unused buffers, attributes and nodes (prune)
 * 3. Welds close/duplicate vertices to reduce mesh size (weld)
 * 4. Compresses geometry using Google Draco (draco)
 *
 * Typical size reduction: 40% to 85% for AI-generated 3D models.
 */
export async function optimizeGlbBuffer(
  inputBuffer: Buffer | Uint8Array,
  options: GlbOptimizeOptions = {}
): Promise<Buffer> {
  try {
    const io = await getOptimizerIO();
    const document = await io.readBinary(new Uint8Array(inputBuffer));

    const transforms = [dedup(), prune(), weld()];

    if (options.enableDraco !== false) {
      transforms.push(
        draco({
          method: "edgebreaker",
          encodeSpeed: 5,
          decodeSpeed: 5,
        })
      );
    }

    await document.transform(...transforms);
    const compressedBytes = await io.writeBinary(document);
    return Buffer.from(compressedBytes);
  } catch (err) {
    if (options.strict) throw err;
    console.warn("[GlbOptimizer] Compression failed, falling back to original buffer:", err);
    return Buffer.isBuffer(inputBuffer) ? inputBuffer : Buffer.from(inputBuffer);
  }
}
