export function assetObjectPath(
  assetId: string,
  version: number,
  kind: "glb" | "preview",
  uniqueId: string
): string {
  const base = `assets/${assetId}/v${version}-${uniqueId}`;
  return kind === "glb" ? `${base}.glb` : `${base}-preview.png`;
}
