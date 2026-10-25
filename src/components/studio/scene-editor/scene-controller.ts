import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";
import { assetBaseScale } from "@/lib/scenes/scale";
import { MAX_OFFSET_CM, MAX_SCENE_ITEMS, type ResolvedSceneItem, type SceneItem } from "@/lib/scenes/types";
import type { ViewerContext } from "../viewer-context";
import { DirtyTracker } from "@/lib/scenes/dirty-tracker";
import { clampScale, itemToTransform, transformToItemFields } from "./convert";

export type EditorMode = "translate" | "rotate" | "scale";

export interface ControllerState {
  selectedId: string | null;
  itemCount: number;
  dirty: boolean;
}

export interface PlaceableAsset {
  assetId: string;
  versionId: string;
  glbUrl: string;
  widthCm: number;
  depthCm: number;
  heightCm: number;
}

interface ItemRecord {
  id: string;
  asset: PlaceableAsset;
  group: THREE.Group;
}

const CLICK_TOLERANCE_PX = 4;
const PLACEHOLDER_COLOR = 0x9ca3af;
const SELECTION_COLOR = 0x7c3aed;

export class SceneController {
  private readonly items = new Map<string, ItemRecord>();
  private readonly modelCache = new Map<string, Promise<THREE.Object3D>>();
  private readonly transform: TransformControls;
  private readonly selectionBox: THREE.BoxHelper;
  private readonly dracoLoader = new DRACOLoader();
  private readonly loader = new GLTFLoader();
  private readonly raycaster = new THREE.Raycaster();
  private readonly floor = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private readonly lastScale = new Map<string, number>();
  private selectedId: string | null = null;
  private readonly tracker = new DirtyTracker();
  private disposed = false;
  private dragging = false;
  private pointerStart: { x: number; y: number } | null = null;
  private pressedGizmo = false;
  private autoRotateBeforeSelect = false;

  constructor(
    private readonly context: ViewerContext,
    private readonly callbacks: { onChange: (state: ControllerState) => void }
  ) {
    this.dracoLoader.setDecoderPath("/draco/");
    this.loader.setDRACOLoader(this.dracoLoader);

    this.transform = new TransformControls(context.camera, context.renderer.domElement);
    this.transform.setSize(0.8);
    context.scene.add(this.transform.getHelper());
    this.setMode("translate");

    this.selectionBox = new THREE.BoxHelper(new THREE.Object3D(), SELECTION_COLOR);
    this.selectionBox.visible = false;
    context.scene.add(this.selectionBox);

    this.transform.addEventListener("dragging-changed", (event) => {
      const isDragging = Boolean((event as unknown as { value: boolean }).value);
      this.dragging = isDragging;
      this.context.controls.enabled = !isDragging;
    });
    this.transform.addEventListener("objectChange", () => this.handleObjectChange());

    const dom = context.renderer.domElement;
    dom.addEventListener("pointerdown", this.onPointerDown);
    dom.addEventListener("pointerup", this.onPointerUp);
  }

  async load(items: ResolvedSceneItem[]): Promise<void> {
    this.select(null);
    [...this.items.keys()].forEach((id) => this.removeRecord(id));
    const revisionAtStart = this.tracker.revision;
    await Promise.all(
      items.slice(0, MAX_SCENE_ITEMS).map((item) => this.createRecord(item, item.id, item))
    );
    if (this.disposed) return;
    this.tracker.clear(revisionAtStart);
    this.emit();
  }

  addAsset(asset: PlaceableAsset, at?: { x: number; z: number }): string | null {
    if (this.items.size >= MAX_SCENE_ITEMS) return null;
    const id = crypto.randomUUID();
    const item: SceneItem = {
      id,
      assetId: asset.assetId,
      versionId: asset.versionId,
      x: at?.x ?? 0,
      z: at?.z ?? 0,
      rotationY: 0,
      scale: 1,
    };
    void this.createRecord(asset, id, item);
    this.tracker.touch();
    this.select(id);
    return id;
  }

  addAssetAtPointer(asset: PlaceableAsset, clientX: number, clientY: number): string | null {
    const rect = this.context.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -(((clientY - rect.top) / rect.height) * 2 - 1)
    );
    this.raycaster.setFromCamera(ndc, this.context.camera);
    const hit = this.raycaster.ray.intersectPlane(this.floor, new THREE.Vector3());
    if (!hit) return this.addAsset(asset);

    const limit = MAX_OFFSET_CM;
    const toCm = (value: number) =>
      Math.min(limit, Math.max(-limit, value / this.context.worldPerCm));
    return this.addAsset(asset, { x: toCm(hit.x), z: toCm(hit.z) });
  }

  select(id: string | null): void {
    const record = id ? this.items.get(id) : undefined;
    const previous = this.selectedId;

    if (record) {
      if (!previous) {
        this.autoRotateBeforeSelect = this.context.controls.autoRotate;
        this.context.controls.autoRotate = false;
      }
      this.selectedId = record.id;
      this.transform.attach(record.group);
      this.selectionBox.setFromObject(record.group);
      this.selectionBox.visible = true;
    } else {
      if (previous) this.context.controls.autoRotate = this.autoRotateBeforeSelect;
      this.selectedId = null;
      this.transform.detach();
      this.selectionBox.visible = false;
    }
    this.emit();
  }

  setMode(mode: EditorMode): void {
    this.transform.setMode(mode);
    this.transform.showX = mode !== "rotate";
    this.transform.showY = mode !== "translate";
    this.transform.showZ = mode !== "rotate";
  }

  removeSelected(): void {
    if (!this.selectedId) return;
    const id = this.selectedId;
    this.select(null);
    this.removeRecord(id);
    this.tracker.touch();
    this.emit();
  }

  serialize(): SceneItem[] {
    return [...this.items.values()].map((record) => {
      const { group } = record;
      return {
        id: record.id,
        assetId: record.asset.assetId,
        versionId: record.asset.versionId,
        ...transformToItemFields(
          { x: group.position.x, z: group.position.z },
          group.rotation.y,
          group.scale.x,
          this.context.worldPerCm
        ),
      };
    });
  }

  get revision(): number {
    return this.tracker.revision;
  }

  markClean(revision?: number): void {
    this.tracker.clear(revision);
    this.emit();
  }

  dispose(): void {
    this.disposed = true;
    const dom = this.context.renderer.domElement;
    dom.removeEventListener("pointerdown", this.onPointerDown);
    dom.removeEventListener("pointerup", this.onPointerUp);
    this.select(null);
    this.context.controls.enabled = true;

    [...this.items.keys()].forEach((id) => this.removeRecord(id));
    this.transform.dispose();
    this.context.scene.remove(this.transform.getHelper());
    this.context.scene.remove(this.selectionBox);
    this.selectionBox.geometry.dispose();
    (this.selectionBox.material as THREE.Material).dispose();

    for (const pending of this.modelCache.values()) {
      void pending.then((model) => disposeObject(model));
    }
    this.modelCache.clear();
    this.dracoLoader.dispose();
  }

  private emit(): void {
    if (this.disposed) return;
    this.callbacks.onChange({
      selectedId: this.selectedId,
      itemCount: this.items.size,
      dirty: this.tracker.dirty,
    });
  }

  private async createRecord(
    asset: PlaceableAsset,
    id: string,
    item: SceneItem
  ): Promise<void> {
    const group = new THREE.Group();
    group.userData.itemId = id;
    const { position, rotationY } = itemToTransform(item, this.context.worldPerCm);
    group.position.set(...position);
    group.rotation.y = rotationY;
    group.scale.setScalar(clampScale(item.scale));

    const record: ItemRecord = { id, asset, group };
    this.items.set(id, record);
    this.context.scene.add(group);
    this.lastScale.set(id, group.scale.x);

    let content: THREE.Object3D;
    try {
      content = (await this.loadModel(asset.glbUrl)).clone(true);
      this.fitModel(content, asset);
    } catch {
      content = this.placeholder(asset);
    }

    if (this.disposed || !this.items.has(id)) {
      return;
    }
    content.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    group.add(content);
    if (this.selectedId === id) this.selectionBox.setFromObject(group);
  }

  private loadModel(url: string): Promise<THREE.Object3D> {
    let pending = this.modelCache.get(url);
    if (!pending) {
      pending = this.loader.loadAsync(url).then((gltf) => gltf.scene);
      this.modelCache.set(url, pending);
    }
    return pending;
  }

  private fitModel(model: THREE.Object3D, asset: PlaceableAsset): void {
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const base = assetBaseScale({
      worldPerCm: this.context.worldPerCm,
      assetMaxCm: Math.max(asset.widthCm, asset.depthCm, asset.heightCm),
      modelMaxSize: Math.max(size.x, size.y, size.z),
    });
    model.scale.multiplyScalar(base);
    model.position.set(-center.x * base, -box.min.y * base, -center.z * base);
  }

  private placeholder(asset: PlaceableAsset): THREE.Object3D {
    const k = this.context.worldPerCm;
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

  private removeRecord(id: string): void {
    const record = this.items.get(id);
    if (!record) return;
    this.context.scene.remove(record.group);
    record.group.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (mesh.isMesh && mesh.userData.placeholder) {
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
      }
    });
    this.items.delete(id);
    this.lastScale.delete(id);
  }

  private handleObjectChange(): void {
    const record = this.selectedId ? this.items.get(this.selectedId) : undefined;
    if (!record) return;
    const { group } = record;

    const limit = MAX_OFFSET_CM * this.context.worldPerCm;
    group.position.set(
      Math.min(limit, Math.max(-limit, group.position.x)),
      0,
      Math.min(limit, Math.max(-limit, group.position.z))
    );

    const previous = this.lastScale.get(record.id) ?? 1;
    const axes = [group.scale.x, group.scale.y, group.scale.z];
    const changed = axes.reduce((best, value) =>
      Math.abs(value - previous) > Math.abs(best - previous) ? value : best
    );
    const uniform = clampScale(changed);
    group.scale.setScalar(uniform);
    this.lastScale.set(record.id, uniform);

    this.selectionBox.setFromObject(group);
    this.tracker.touch();
    this.emit();
  }

  private readonly onPointerDown = (event: PointerEvent) => {
    this.pointerStart = { x: event.clientX, y: event.clientY };
    this.pressedGizmo = this.transform.axis !== null;
  };

  private readonly onPointerUp = (event: PointerEvent) => {
    const start = this.pointerStart;
    this.pointerStart = null;
    if (!start || this.dragging || this.pressedGizmo) return;
    const moved = Math.hypot(event.clientX - start.x, event.clientY - start.y);
    if (moved > CLICK_TOLERANCE_PX) return;

    const rect = this.context.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -(((event.clientY - rect.top) / rect.height) * 2 - 1)
    );
    this.raycaster.setFromCamera(ndc, this.context.camera);
    const groups = [...this.items.values()].map((record) => record.group);
    const hit = this.raycaster.intersectObjects(groups, true)[0];

    let target: THREE.Object3D | null = hit?.object ?? null;
    while (target && !target.userData.itemId) target = target.parent;
    this.select(target ? (target.userData.itemId as string) : null);
  };
}

function disposeObject(root: THREE.Object3D): void {
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
