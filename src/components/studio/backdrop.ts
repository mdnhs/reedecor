import * as THREE from "three";

export type BackdropMode = "auto" | "studio" | "white" | "transparent";

export interface ProductTone {
  h: number;
  s: number;
  l: number;
}

interface BackdropPalette {
  top: string;
  floor: string;
  edge: string;
}

const SAMPLE_SIZE = 16;
const CANVAS_SIZE = 512;

function averageTextureColor(texture: THREE.Texture): THREE.Color | null {
  const image = texture.image as CanvasImageSource | undefined;
  if (!image) return null;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = SAMPLE_SIZE;
    canvas.height = SAMPLE_SIZE;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(image, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
    const { data } = ctx.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
    let r = 0;
    let g = 0;
    let b = 0;
    const pixels = data.length / 4;
    for (let i = 0; i < data.length; i += 4) {
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
    }
    return new THREE.Color().setRGB(
      r / pixels / 255,
      g / pixels / 255,
      b / pixels / 255,
      THREE.SRGBColorSpace
    );
  } catch {
    return null;
  }
}

function meshSurfaceWeight(mesh: THREE.Mesh): number {
  const geometry = mesh.geometry;
  if (!geometry.boundingBox) geometry.computeBoundingBox();
  const size = geometry.boundingBox?.getSize(new THREE.Vector3());
  if (!size) return 1;
  return 2 * (size.x * size.y + size.y * size.z + size.z * size.x) || 1;
}

export function extractProductTone(model: THREE.Object3D): ProductTone | null {
  const total = new THREE.Color(0, 0, 0);
  let totalWeight = 0;

  model.traverse((child) => {
    if (!(child as THREE.Mesh).isMesh) return;
    const mesh = child as THREE.Mesh;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const weight = meshSurfaceWeight(mesh) / materials.length;

    materials.forEach((mat) => {
      const standard = mat as THREE.MeshStandardMaterial;
      if (!standard?.color) return;
      const color = standard.color.clone();
      if (standard.map) {
        const sampled = averageTextureColor(standard.map);
        if (sampled) color.multiply(sampled);
      }
      total.r += color.r * weight;
      total.g += color.g * weight;
      total.b += color.b * weight;
      totalWeight += weight;
    });
  });

  if (totalWeight === 0) return null;
  total.multiplyScalar(1 / totalWeight);
  const hsl = { h: 0, s: 0, l: 0 };
  total.getHSL(hsl, THREE.SRGBColorSpace);
  return hsl;
}

function hsl(h: number, s: number, l: number): string {
  const clamp = (v: number) => Math.min(1, Math.max(0, v));
  return `hsl(${Math.round(h * 360)} ${Math.round(clamp(s) * 100)}% ${Math.round(clamp(l) * 100)}%)`;
}

// Cool-leaning neutral opposite the product hue so the product's own colour pops; lightness flips with product lightness for contrast
function autoPalette(tone: ProductTone): BackdropPalette {
  const hue = (tone.h + 0.5) % 1;
  const sat = 0.04 + tone.s * 0.1;
  const base = tone.l < 0.35 ? 0.82 : tone.l > 0.7 ? 0.66 : 0.76;
  return {
    top: hsl(hue, sat, base - 0.08),
    floor: hsl(hue, sat, base + 0.06),
    edge: hsl(hue, sat, base - 0.2),
  };
}

function neutralPalette(base: number): BackdropPalette {
  return {
    top: hsl(0, 0, base - 0.06),
    floor: hsl(0, 0, base + 0.03),
    edge: hsl(0, 0, base - 0.14),
  };
}

function resolvePalette(mode: BackdropMode, tone: ProductTone | null): BackdropPalette {
  if (mode === "white") return neutralPalette(0.96);
  if (mode === "auto" && tone) return autoPalette(tone);
  return neutralPalette(0.76);
}

function createBackdropTexture({ top, floor, edge }: BackdropPalette): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_SIZE;
  canvas.height = CANVAS_SIZE;
  const ctx = canvas.getContext("2d")!;

  const wall = ctx.createLinearGradient(0, 0, 0, CANVAS_SIZE);
  wall.addColorStop(0, top);
  wall.addColorStop(0.55, top);
  wall.addColorStop(1, floor);
  ctx.fillStyle = wall;
  ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

  const vignette = ctx.createRadialGradient(
    CANVAS_SIZE / 2,
    CANVAS_SIZE * 0.55,
    CANVAS_SIZE * 0.25,
    CANVAS_SIZE / 2,
    CANVAS_SIZE * 0.55,
    CANVAS_SIZE * 0.8
  );
  vignette.addColorStop(0, edge.replace(")", " / 0)"));
  vignette.addColorStop(1, edge);
  ctx.globalAlpha = 0.45;
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function disposeBackdrop(scene: THREE.Scene) {
  if (scene.background instanceof THREE.Texture) scene.background.dispose();
  scene.background = null;
}

export function applyBackdrop(
  scene: THREE.Scene,
  mode: BackdropMode,
  tone: ProductTone | null
) {
  disposeBackdrop(scene);
  if (mode === "transparent") return;
  scene.background = createBackdropTexture(resolvePalette(mode, tone));
}
