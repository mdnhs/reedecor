import * as THREE from "three";

export interface ContactShadowOptions {
  opacity?: number;
  contactHeightRatio?: number;
  blurPasses?: number;
}

const CANVAS_SIZE = 256;
const DEFAULT_MARGIN = 0.18;

/**
 * Procedurally generates a soft, grounded ambient contact shadow
 * directly beneath a 3D model's footprint and contact points.
 */
export function createContactShadow(
  model: THREE.Object3D,
  options?: ContactShadowOptions
): THREE.Mesh | null {
  if (typeof document === "undefined") return null;

  model.updateMatrixWorld(true);
  const bbox = new THREE.Box3().setFromObject(model);
  if (bbox.isEmpty()) return null;

  const size = bbox.getSize(new THREE.Vector3());
  const width = Math.max(0.1, size.x);
  const depth = Math.max(0.1, size.z);
  const height = Math.max(0.1, size.y);

  const contactThreshold = Math.min(0.06, height * (options?.contactHeightRatio ?? 0.08));
  const minY = bbox.min.y;

  // Sample vertices located close to the bottom ground contact plane
  const contactPoints: Array<{ x: number; z: number; closeness: number }> = [];
  const vertex = new THREE.Vector3();

  model.traverse((child) => {
    if (!(child as THREE.Mesh).isMesh) return;
    const mesh = child as THREE.Mesh;
    const pos = mesh.geometry?.attributes?.position;
    if (!pos) return;

    const matrix = mesh.matrixWorld;
    const count = pos.count;
    // Cap samples to avoid processing overhead on ultra-dense meshes
    const step = Math.max(1, Math.floor(count / 1200));

    for (let i = 0; i < count; i += step) {
      vertex.fromBufferAttribute(pos, i).applyMatrix4(matrix);
      const dy = vertex.y - minY;
      if (dy >= -0.005 && dy <= contactThreshold) {
        const closeness = Math.max(0, Math.min(1, 1 - dy / contactThreshold));
        contactPoints.push({ x: vertex.x, z: vertex.z, closeness });
      }
    }
  });

  const margin = Math.max(DEFAULT_MARGIN, Math.max(width, depth) * 0.15);
  const planeWidth = width + margin * 2;
  const planeDepth = depth + margin * 2;

  const minX = bbox.min.x - margin;
  const minZ = bbox.min.z - margin;

  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_SIZE;
  canvas.height = CANVAS_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const toPxX = (x: number) => ((x - minX) / planeWidth) * CANVAS_SIZE;
  const toPxZ = (z: number) => ((z - minZ) / planeDepth) * CANVAS_SIZE;

  const centerX = (bbox.min.x + bbox.max.x) / 2;
  const centerZ = (bbox.min.z + bbox.max.z) / 2;
  const centerPxX = toPxX(centerX);
  const centerPxZ = toPxZ(centerZ);

  // 1. Broad Ambient Base Occlusion (soft body shadow under the model)
  ctx.save();
  const radiusX = (width * 0.52 / planeWidth) * CANVAS_SIZE;
  const radiusZ = (depth * 0.52 / planeDepth) * CANVAS_SIZE;

  ctx.translate(centerPxX, centerPxZ);
  ctx.scale(1, radiusZ / (radiusX || 1));
  const baseGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, radiusX);
  baseGrad.addColorStop(0, "rgba(0, 0, 0, 0.38)");
  baseGrad.addColorStop(0.35, "rgba(0, 0, 0, 0.22)");
  baseGrad.addColorStop(0.7, "rgba(0, 0, 0, 0.08)");
  baseGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = baseGrad;
  ctx.beginPath();
  ctx.arc(0, 0, radiusX, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 2. Focused Contact Points / Feet Occlusion
  if (contactPoints.length > 0) {
    const spotWorldRadius = Math.max(0.03, Math.min(width, depth) * 0.08);
    const spotCanvasRadius = (spotWorldRadius / Math.min(planeWidth, planeDepth)) * CANVAS_SIZE;

    for (const pt of contactPoints) {
      const px = toPxX(pt.x);
      const pz = toPxZ(pt.z);
      const alpha = 0.42 * Math.pow(pt.closeness, 1.6);
      const rad = spotCanvasRadius * (0.8 + (1 - pt.closeness) * 0.6);

      const grad = ctx.createRadialGradient(px, pz, 0, px, pz, rad);
      grad.addColorStop(0, `rgba(0, 0, 0, ${alpha.toFixed(3)})`);
      grad.addColorStop(0.5, `rgba(0, 0, 0, ${(alpha * 0.4).toFixed(3)})`);
      grad.addColorStop(1, "rgba(0, 0, 0, 0)");

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(px, pz, rad, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 3. Fast In-Place Blur for Soft Photography Look
  applyBoxBlur(ctx, CANVAS_SIZE, CANVAS_SIZE, 3);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  const geo = new THREE.PlaneGeometry(planeWidth, planeDepth);
  const mat = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    opacity: options?.opacity ?? 0.88,
    depthWrite: false,
    toneMapped: false,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = "__contact_shadow__";
  mesh.rotation.x = -Math.PI / 2;
  // Position right at ground level, lifted slightly to prevent any z-fighting
  mesh.position.set(centerX, minY + 0.001, centerZ);
  mesh.renderOrder = 2;

  return mesh;
}

export function disposeContactShadow(mesh: THREE.Mesh | null): void {
  if (!mesh) return;
  mesh.geometry?.dispose();
  if (mesh.material instanceof THREE.Material) {
    if ("map" in mesh.material && mesh.material.map instanceof THREE.Texture) {
      mesh.material.map.dispose();
    }
    mesh.material.dispose();
  }
  mesh.parent?.remove(mesh);
}

/**
 * Fast horizontal & vertical sliding box blur on 2D canvas imageData
 */
function applyBoxBlur(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  radius: number
): void {
  try {
    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;
    const temp = new Uint8ClampedArray(data.length);

    // Horizontal pass
    for (let y = 0; y < h; y++) {
      const yOffset = y * w * 4;
      for (let x = 0; x < w; x++) {
        let a = 0;
        let count = 0;
        for (let k = -radius; k <= radius; k++) {
          const nx = x + k;
          if (nx >= 0 && nx < w) {
            a += data[yOffset + nx * 4 + 3];
            count++;
          }
        }
        temp[yOffset + x * 4 + 3] = a / count;
      }
    }

    // Vertical pass
    for (let x = 0; x < w; x++) {
      for (let y = 0; y < h; y++) {
        let a = 0;
        let count = 0;
        for (let k = -radius; k <= radius; k++) {
          const ny = y + k;
          if (ny >= 0 && ny < h) {
            a += temp[ny * w * 4 + x * 4 + 3];
            count++;
          }
        }
        data[y * w * 4 + x * 4 + 3] = a / count;
      }
    }

    ctx.putImageData(imgData, 0, 0);
  } catch {
    // If getImageData is restricted (e.g. cross-origin canvas), fail gracefully
  }
}
