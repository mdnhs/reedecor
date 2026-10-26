import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { assetBaseScale } from "@/lib/scenes/scale";
import type { SceneItem } from "@/lib/scenes/types";
import { clampScale, itemToTransform } from "../scene-editor/convert";

export interface PlaceableAsset {
  assetId: string;
  versionId: string;
  glbUrl: string;
  widthCm: number;
  depthCm: number;
  heightCm: number;
}

const PLACEHOLDER_COLOR = 0x9ca3af;

export class ItemLoader {
  private readonly modelCache = new Map<string, Promise<THREE.Object3D>>();
  private readonly dracoLoader = new DRACOLoader();
  private readonly loader = new GLTFLoader();

  constructor(private readonly worldPerCm: number) {
    this.dracoLoader.setDecoderPath("/draco/");
    this.loader.setDRACOLoader(this.dracoLoader);
  }

  createGroup(id: string, item: SceneItem): THREE.Group {
    const group = new THREE.Group();
    group.userData.itemId = id;
    const { position, rotationY } = itemToTransform(item, this.worldPerCm);
    group.position.set(...position);
    group.rotation.y = rotationY;
    group.scale.setScalar(clampScale(item.scale));
    return group;
  }

  async fill(group: THREE.Group, asset: PlaceableAsset, isActive: () => boolean): Promise<void> {
    let content: THREE.Object3D;
    try {
      content = (await this.loadModel(asset.glbUrl)).clone(true);
      this.fitModel(content, asset);
    } catch {
      content = this.placeholder(asset);
    }

    if (!isActive()) {
      disposeGroup(content as THREE.Group);
      return;
    }
    content.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    group.add(content);
  }

  dispose(): void {
    for (const pending of this.modelCache.values()) {
      pending.then(disposeModel, () => undefined);
    }
    this.modelCache.clear();
    this.dracoLoader.dispose();
  }

  private loadModel(url: string): Promise<THREE.Object3D> {
    let pending = this.modelCache.get(url);
    if (!pending) {
      pending = this.loader
        .loadAsync(url)
        .then((gltf) => gltf.scene)
        .catch((error) => {
          this.modelCache.delete(url);
          throw error;
        });
      this.modelCache.set(url, pending);
    }
    return pending;
  }

  private fitModel(model: THREE.Object3D, asset: PlaceableAsset): void {
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const base = assetBaseScale({
      worldPerCm: this.worldPerCm,
      assetMaxCm: Math.max(asset.widthCm, asset.depthCm, asset.heightCm),
      modelMaxSize: Math.max(size.x, size.y, size.z),
    });
    model.scale.multiplyScalar(base);
    model.position.set(-center.x * base, -box.min.y * base, -center.z * base);
  }

  private placeholder(asset: PlaceableAsset): THREE.Group {
    const k = this.worldPerCm;
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(asset.widthCm * k, asset.heightCm * k, asset.depthCm * k),
      new THREE.MeshStandardMaterial({ color: PLACEHOLDER_COLOR, transparent: true, opacity: 0.6 })
    );
    mesh.position.y = (asset.heightCm * k) / 2;
    mesh.userData.placeholder = true;
    const holder = new THREE.Group();
    holder.add(mesh);
    return holder;
  }
}

export function disposeGroup(group: THREE.Object3D): void {
  group.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.isMesh && mesh.userData.placeholder) {
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    }
  });
}

export function disposeModel(root: THREE.Object3D): void {
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
