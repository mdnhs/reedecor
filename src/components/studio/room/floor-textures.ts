import * as THREE from "three";
import type { FloorType } from "@/lib/scenes/room";
import { seededRandom } from "../seeded-random";

const CANVAS_PX = 1024;

const REPEAT_ON_FLOOR: Record<FloorType, number> = {
  oak: 5,
  walnut: 5,
  concrete: 3,
  tile: 5,
};

function paintWood(ctx: CanvasRenderingContext2D, hue: number, sat: number, light: number) {
  const random = seededRandom(hue * 1000 + light);
  const plankPx = CANVAS_PX / 10;
  const segmentPx = CANVAS_PX / 2;

  for (let column = 0; column < 10; column++) {
    const x = column * plankPx;
    const stagger = (column % 2) * (segmentPx / 2);
    for (let row = -1; row < 3; row++) {
      const y = row * segmentPx + stagger;
      const tone = light + (random() - 0.5) * 8;
      ctx.fillStyle = `hsl(${hue + (random() - 0.5) * 4} ${sat}% ${tone}%)`;
      ctx.fillRect(x, y, plankPx, segmentPx);

      for (let grain = 0; grain < 14; grain++) {
        const gx = x + random() * plankPx;
        ctx.strokeStyle = `hsl(${hue} ${sat}% ${tone - 6 - random() * 6}% / 0.35)`;
        ctx.lineWidth = 0.6 + random() * 1.2;
        ctx.beginPath();
        ctx.moveTo(gx, y);
        ctx.bezierCurveTo(gx + 4, y + segmentPx * 0.3, gx - 4, y + segmentPx * 0.7, gx + 2, y + segmentPx);
        ctx.stroke();
      }

      ctx.fillStyle = `hsl(${hue} ${sat}% ${light - 22}% / 0.55)`;
      ctx.fillRect(x, y, plankPx, 2);
    }
    ctx.fillStyle = `hsl(${hue} ${sat}% ${light - 22}% / 0.55)`;
    ctx.fillRect(x, 0, 2, CANVAS_PX);
  }
}

function paintConcrete(ctx: CanvasRenderingContext2D) {
  const random = seededRandom(7);
  ctx.fillStyle = "#b4b4b1";
  ctx.fillRect(0, 0, CANVAS_PX, CANVAS_PX);

  for (let blotch = 0; blotch < 260; blotch++) {
    const radius = 20 + random() * 90;
    const light = 62 + random() * 20;
    ctx.fillStyle = `hsl(40 3% ${light}% / ${0.05 + random() * 0.08})`;
    ctx.beginPath();
    ctx.arc(random() * CANVAS_PX, random() * CANVAS_PX, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  const image = ctx.getImageData(0, 0, CANVAS_PX, CANVAS_PX);
  for (let i = 0; i < image.data.length; i += 4) {
    const noise = (random() - 0.5) * 14;
    image.data[i] += noise;
    image.data[i + 1] += noise;
    image.data[i + 2] += noise;
  }
  ctx.putImageData(image, 0, 0);
}

function paintTile(ctx: CanvasRenderingContext2D) {
  const random = seededRandom(11);
  const tilePx = CANVAS_PX / 2;
  const groutPx = 8;

  ctx.fillStyle = "#c9c9c6";
  ctx.fillRect(0, 0, CANVAS_PX, CANVAS_PX);
  for (let row = 0; row < 2; row++) {
    for (let column = 0; column < 2; column++) {
      const light = 93 + random() * 3;
      ctx.fillStyle = `hsl(40 6% ${light}%)`;
      ctx.fillRect(column * tilePx + groutPx / 2, row * tilePx + groutPx / 2, tilePx - groutPx, tilePx - groutPx);
    }
  }
}

export function createFloorTexture(type: FloorType, renderer: THREE.WebGLRenderer): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_PX;
  canvas.height = CANVAS_PX;
  const ctx = canvas.getContext("2d")!;

  if (type === "oak") paintWood(ctx, 33, 36, 50);
  else if (type === "walnut") paintWood(ctx, 22, 35, 28);
  else if (type === "concrete") paintConcrete(ctx);
  else paintTile(ctx);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(REPEAT_ON_FLOOR[type], REPEAT_ON_FLOOR[type]);
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return texture;
}
