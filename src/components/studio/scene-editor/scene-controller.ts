import * as THREE from "three";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";
import { MAX_OFFSET_CM, MAX_SCENE_ITEMS, type ResolvedSceneItem, type SceneItem } from "@/lib/scenes/types";
import type { ViewerContext } from "../viewer-context";
import { DirtyTracker } from "@/lib/scenes/dirty-tracker";
import { ItemLoader, disposeGroup, type PlaceableAsset } from "../scene/item-loader";
import { clampScale, transformToItemFields } from "./convert";

export type EditorMode = "translate" | "rotate" | "scale";

export interface ControllerState {
  selectedId: string | null;
  itemCount: number;
  dirty: boolean;
}

export type { PlaceableAsset };

interface ItemRecord {
  id: string;
  asset: PlaceableAsset;
  group: THREE.Group;
}

const CLICK_TOLERANCE_PX = 4;
const SELECTION_COLOR = 0x7c3aed;

export class SceneController {
  private readonly items = new Map<string, ItemRecord>();
  private readonly transform: TransformControls;
  private readonly selectionBox: THREE.BoxHelper;
  private readonly loader: ItemLoader;
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
    this.loader = new ItemLoader(context.worldPerCm);

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

    this.loader.dispose();
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
    const group = this.loader.createGroup(id, item);
    this.items.set(id, { id, asset, group });
    this.context.scene.add(group);
    this.lastScale.set(id, group.scale.x);

    await this.loader.fill(group, asset, () => !this.disposed && this.items.has(id));
    if (this.disposed || !this.items.has(id)) return;
    if (this.selectedId === id) this.selectionBox.setFromObject(group);
  }

  private removeRecord(id: string): void {
    const record = this.items.get(id);
    if (!record) return;
    this.context.scene.remove(record.group);
    disposeGroup(record.group);
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
