import type * as THREE from "three";
import { MAX_SCENE_ITEMS, type ResolvedScene } from "@/lib/scenes/types";
import type { ViewerContext } from "../viewer-context";
import { RoomRenderer } from "../room/room-renderer";
import { ItemLoader, disposeGroup } from "./item-loader";

export class SceneView {
  private readonly loader: ItemLoader;
  private readonly room: RoomRenderer;
  private readonly groups: THREE.Group[] = [];
  private disposed = false;

  constructor(private readonly context: ViewerContext) {
    this.loader = new ItemLoader(context.worldPerCm);
    this.room = new RoomRenderer(context);
  }

  async load(scene: ResolvedScene): Promise<void> {
    if (this.disposed) return;
    this.room.apply(scene.room);

    const fills = scene.items.slice(0, MAX_SCENE_ITEMS).map((item) => {
      const group = this.loader.createGroup(item.id, item);
      this.groups.push(group);
      this.context.scene.add(group);
      return this.loader.fill(group, item, () => !this.disposed);
    });
    await Promise.all(fills);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const group of this.groups) {
      this.context.scene.remove(group);
      disposeGroup(group);
    }
    this.groups.length = 0;
    this.room.dispose();
    this.loader.dispose();
  }
}
