const PRODUCT_WORLD_SIZE = 1.05;
const MM_PER_CM = 10;

export const DEFAULT_PRODUCT_CM = { width: 85, depth: 75, height: 82 } as const;

interface ProductSize {
  widthMm?: number | null;
  depthMm?: number | null;
  heightMm?: number | null;
}

export function worldUnitsPerCm(product: ProductSize): number {
  const sides = [product.widthMm, product.depthMm, product.heightMm];
  const usable = sides.every((side) => typeof side === "number" && side > 0);
  const maxCm = usable
    ? Math.max(...(sides as number[])) / MM_PER_CM
    : Math.max(...Object.values(DEFAULT_PRODUCT_CM));
  return PRODUCT_WORLD_SIZE / maxCm;
}

export function assetBaseScale(args: {
  worldPerCm: number;
  assetMaxCm: number;
  modelMaxSize: number;
}): number {
  if (!(args.modelMaxSize > 0)) return 1;
  return (args.worldPerCm * args.assetMaxCm) / args.modelMaxSize;
}
