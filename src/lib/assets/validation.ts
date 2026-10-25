import { z } from "zod";

export const MAX_ASSET_BYTES = 2 * 1024 * 1024;

const GLB_HEADER_BYTES = 12;

export function validateGlb(
  buffer: Uint8Array
): { ok: true } | { ok: false; error: string } {
  if (buffer.length < GLB_HEADER_BYTES) {
    return { ok: false, error: "File is too small to be a GLB model." };
  }
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  if (view.getUint32(0, true) !== 0x46546c67) {
    return { ok: false, error: "File is not a GLB model (bad header)." };
  }
  if (view.getUint32(4, true) !== 2) {
    return { ok: false, error: "Only glTF 2.0 GLB files are supported." };
  }
  if (view.getUint32(8, true) !== buffer.length) {
    return { ok: false, error: "GLB file is truncated or corrupted." };
  }
  return { ok: true };
}

const sizeCm = z.number().positive().max(1000);

const assetFields = z.object({
  name: z.string().trim().min(1).max(80),
  categoryId: z.string().min(1),
  accessLevel: z.enum(["free", "pro", "selected"]),
  placement: z.enum(["floor", "wall"]),
  widthCm: sizeCm,
  depthCm: sizeCm,
  heightCm: sizeCm,
});

const allowList = z.array(z.string());

export const assetMetaSchema = assetFields.extend({ allowedMerchantIds: allowList.default([]) });

export const assetUpdateSchema = assetFields
  .omit({ widthCm: true, depthCm: true, heightCm: true })
  .partial()
  .extend({ allowedMerchantIds: allowList.optional(), hidden: z.boolean().optional() });
