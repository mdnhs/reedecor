import * as THREE from "three";
import {
  STUDIO_PRESETS,
  hslCss,
  studioPresetPalette,
  type BackdropMode,
  type BackdropPalette,
} from "@/lib/scenes/backdrops";
import { seededRandom } from "./seeded-random";

export type { BackdropMode };

export interface ProductTone {
  h: number;
  s: number;
  l: number;
}

const SAMPLE_SIZE = 16;

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

const hsl = hslCss;

const AUTO_MAX_SATURATION = 0.32;
const AUTO_NEUTRAL = { h: 0.6, s: 0.03, l: 0.72 };

// Muted tint opposite the product hue so the product's own colour pops; lightness flips with product lightness for contrast
function autoPalette(tone: ProductTone | null): BackdropPalette {
  if (!tone) return studioPresetPalette(AUTO_NEUTRAL);

  const colourful = tone.s > 0.08;
  return studioPresetPalette({
    h: (tone.h + 0.5) % 1,
    s: colourful ? Math.min(AUTO_MAX_SATURATION, 0.1 + tone.s * 0.2) : 0.04,
    l: tone.l < 0.35 ? 0.8 : tone.l > 0.7 ? 0.58 : 0.7,
  });
}

const PURE_WHITE: BackdropPalette = {
  top: hsl(0, 0, 1),
  floor: hsl(0, 0, 1),
  edge: hsl(0, 0, 1),
};

function neutralPalette(base: number): BackdropPalette {
  return {
    top: hsl(0, 0, base - 0.06),
    floor: hsl(0, 0, base + 0.03),
    edge: hsl(0, 0, base - 0.14),
  };
}

export function resolvePalette(mode: BackdropMode, tone: ProductTone | null): BackdropPalette {
  if (mode === "white") return PURE_WHITE;
  const preset = STUDIO_PRESETS.find((p) => p.mode === mode);
  if (preset) return studioPresetPalette(preset);
  if (mode === "auto") return autoPalette(tone);
  return neutralPalette(0.76);
}

const CANVAS_PX = 1024;
const VIGNETTE_ALPHA = 0.45;
const GRAIN_AMPLITUDE = 5;
const SPOT_CENTER_Y = 0.64;
const SPOT_SQUASH = 0.55;

function paintSpot(ctx: CanvasRenderingContext2D, spot: NonNullable<BackdropPalette["spot"]>) {
  ctx.save();
  ctx.translate(CANVAS_PX / 2, CANVAS_PX * SPOT_CENTER_Y);
  ctx.scale(1, SPOT_SQUASH);
  const pool = ctx.createRadialGradient(0, 0, 0, 0, 0, CANVAS_PX * 0.5);
  pool.addColorStop(0, spot.color.replace(")", ` / ${spot.alpha})`));
  pool.addColorStop(1, spot.color.replace(")", " / 0)"));
  ctx.fillStyle = pool;
  ctx.fillRect(-CANVAS_PX, -CANVAS_PX, CANVAS_PX * 2, CANVAS_PX * 2);
  ctx.restore();

  const glow = ctx.createRadialGradient(CANVAS_PX / 2, CANVAS_PX * 0.36, 0, CANVAS_PX / 2, CANVAS_PX * 0.36, CANVAS_PX * 0.45);
  glow.addColorStop(0, spot.color.replace(")", ` / ${spot.alpha * 0.35})`));
  glow.addColorStop(1, spot.color.replace(")", " / 0)"));
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, CANVAS_PX, CANVAS_PX);
}

function paintGrain(ctx: CanvasRenderingContext2D) {
  const random = seededRandom(5);
  const image = ctx.getImageData(0, 0, CANVAS_PX, CANVAS_PX);
  for (let i = 0; i < image.data.length; i += 4) {
    const noise = (random() - 0.5) * 2 * GRAIN_AMPLITUDE;
    image.data[i] += noise;
    image.data[i + 1] += noise;
    image.data[i + 2] += noise;
  }
  ctx.putImageData(image, 0, 0);
}

function createBackdropTexture({ top, floor, edge, spot, grain }: BackdropPalette): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_PX;
  canvas.height = CANVAS_PX;
  const ctx = canvas.getContext("2d", { willReadFrequently: !!grain })!;

  const wall = ctx.createLinearGradient(0, 0, 0, CANVAS_PX);
  wall.addColorStop(0, top);
  wall.addColorStop(0.55, top);
  wall.addColorStop(1, floor);
  ctx.fillStyle = wall;
  ctx.fillRect(0, 0, CANVAS_PX, CANVAS_PX);

  if (spot) paintSpot(ctx, spot);

  const vignette = ctx.createRadialGradient(
    CANVAS_PX / 2,
    CANVAS_PX * 0.55,
    CANVAS_PX * 0.25,
    CANVAS_PX / 2,
    CANVAS_PX * 0.55,
    CANVAS_PX * 0.8
  );
  vignette.addColorStop(0, edge.replace(")", " / 0)"));
  vignette.addColorStop(1, edge);
  ctx.globalAlpha = VIGNETTE_ALPHA;
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, CANVAS_PX, CANVAS_PX);
  ctx.globalAlpha = 1;

  if (grain) paintGrain(ctx);

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
