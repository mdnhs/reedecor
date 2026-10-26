import { describe, it, expect } from "vitest";
import { decodeImageDataUrl, MAX_PRODUCT_IMAGE_BYTES } from "../src/server/product-images";

const png = `data:image/png;base64,${Buffer.from("png-bytes").toString("base64")}`;

describe("decodeImageDataUrl", () => {
  it("decodes a supported image", () => {
    const result = decodeImageDataUrl(png);
    expect(result).toMatchObject({ mimeType: "image/png" });
    expect(result && "buffer" in result && result.buffer.toString()).toBe("png-bytes");
  });

  it("rejects unsupported types", () => {
    expect(decodeImageDataUrl("data:image/svg+xml;base64,PHN2Zz4=")).toEqual({ error: "Images must be JPEG, PNG or WebP." });
  });

  it("rejects remote URLs", () => {
    expect(decodeImageDataUrl("https://evil.com/a.jpg")).toEqual({ error: "Images must be uploaded files." });
  });

  it("rejects images over the size limit", () => {
    const big = `data:image/jpeg;base64,${Buffer.alloc(MAX_PRODUCT_IMAGE_BYTES + 1).toString("base64")}`;
    expect(decodeImageDataUrl(big)).toEqual({ error: "Each image must be 10 MB or smaller." });
  });
});
