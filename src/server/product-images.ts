export const MAX_PRODUCT_IMAGE_BYTES = 10 * 1024 * 1024;
// Four 10 MB photos grow by a third as base64, plus room for the JSON fields
export const MAX_PRODUCT_REQUEST_BYTES = 4 * Math.ceil((MAX_PRODUCT_IMAGE_BYTES * 4) / 3) + 1024 * 1024;

export const IMAGE_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const ALLOWED_IMAGE_TYPES = Object.keys(IMAGE_EXTENSIONS);

export function decodeImageDataUrl(
  dataUrl: string
): { buffer: Buffer; mimeType: string } | { error: string } {
  const match = /^data:([a-z0-9.+/-]+);base64,(.*)$/i.exec(dataUrl);
  if (!match) return { error: "Images must be uploaded files." };

  const mimeType = match[1].toLowerCase();
  if (!ALLOWED_IMAGE_TYPES.includes(mimeType)) return { error: "Images must be JPEG, PNG or WebP." };

  const buffer = Buffer.from(match[2], "base64");
  if (buffer.length === 0 || buffer.length > MAX_PRODUCT_IMAGE_BYTES) {
    return { error: "Each image must be 10 MB or smaller." };
  }
  return { buffer, mimeType };
}
