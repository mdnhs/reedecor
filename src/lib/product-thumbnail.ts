import type { StoredProduct } from "@/server/demo-store";

export function getProductThumbnail(
  product: Pick<StoredProduct, "thumbnailUrl" | "images">
): string | undefined {
  return (
    product.thumbnailUrl ||
    product.images?.find((img) => img.viewType === "front")?.publicUrl ||
    product.images?.[0]?.publicUrl
  );
}
