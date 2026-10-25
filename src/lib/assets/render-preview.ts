import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { applyBackdrop, disposeBackdrop } from "@/components/studio/backdrop";

export interface GlbPreview {
  blob: Blob;
  dimensionsCm: { width: number; depth: number; height: number };
}

const CM_PER_METER = 100;

function loadGltf(url: string): Promise<THREE.Group> {
  const dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath("/draco/");
  const loader = new GLTFLoader();
  loader.setDRACOLoader(dracoLoader);

  return new Promise((resolve, reject) => {
    loader.load(
      url,
      (gltf) => {
        dracoLoader.dispose();
        resolve(gltf.scene);
      },
      undefined,
      () => {
        dracoLoader.dispose();
        reject(new Error("The 3D file could not be read."));
      }
    );
  });
}

function disposeObject(root: THREE.Object3D) {
  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry?.dispose();
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    materials.forEach((material) => {
      Object.values(material).forEach((value) => {
        if (value instanceof THREE.Texture) value.dispose();
      });
      material.dispose();
    });
  });
}

export async function renderGlbPreview(file: File, size = 512): Promise<GlbPreview> {
  const url = URL.createObjectURL(file);
  let model: THREE.Group | null = null;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });

  try {
    model = await loadGltf(url);

    renderer.setSize(size, size, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NeutralToneMapping;

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const environment = pmrem.fromScene(new RoomEnvironment()).texture;
    scene.environment = environment;
    applyBackdrop(scene, "studio", null);
    scene.add(model);

    const box = new THREE.Box3().setFromObject(model);
    const dimensions = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const radius = Math.max(dimensions.x, dimensions.y, dimensions.z) / 2 || 1;

    const camera = new THREE.PerspectiveCamera(35, 1, radius / 100, radius * 100);
    const distance = radius / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2)) * 1.1;
    camera.position.set(
      center.x + distance * 0.6,
      center.y + distance * 0.4,
      center.z + distance * 0.7
    );
    camera.lookAt(center);

    renderer.render(scene, camera);

    const blob = await new Promise<Blob>((resolve, reject) =>
      renderer.domElement.toBlob(
        (out) => (out ? resolve(out) : reject(new Error("Could not create the preview image."))),
        "image/png"
      )
    );

    disposeBackdrop(scene);
    environment.dispose();
    pmrem.dispose();

    return {
      blob,
      dimensionsCm: {
        width: Math.round(dimensions.x * CM_PER_METER * 10) / 10,
        depth: Math.round(dimensions.z * CM_PER_METER * 10) / 10,
        height: Math.round(dimensions.y * CM_PER_METER * 10) / 10,
      },
    };
  } finally {
    URL.revokeObjectURL(url);
    if (model) disposeObject(model);
    renderer.dispose();
    renderer.forceContextLoss();
  }
}
