import * as THREE from "three";
import { ROOM_SIZE_CM, type FloorType, type RoomSettings } from "@/lib/scenes/room";
import type { ViewerContext } from "../viewer-context";
import { STUDIO_FLOOR_NAME } from "../backdrop";
import { createFloorTexture } from "./floor-textures";

const FLOOR_ROUGHNESS = 0.85;
const WALL_ROUGHNESS = 0.95;
const ROOM_SHADOW_OPACITY = 0.35;
const GROUND_LIFT_CM = 0.5;

export class RoomRenderer {
  private group: THREE.Group | null = null;
  private floorMaterial: THREE.MeshStandardMaterial | null = null;
  private wallMaterial: THREE.MeshStandardMaterial | null = null;
  private floorTexture: THREE.CanvasTexture | null = null;
  private floorType: FloorType | null = null;
  private readonly groundDefaults: { y: number; opacity: number };

  constructor(private readonly context: ViewerContext) {
    this.groundDefaults = {
      y: context.ground.position.y,
      opacity: (context.ground.material as THREE.ShadowMaterial).opacity,
    };
  }

  apply(room: RoomSettings | undefined): void {
    if (!room || !room.enabled) {
      this.teardown();
      return;
    }

    if (!this.group) this.build();
    this.wallMaterial!.color.set(room.wallColor);

    if (room.floorType !== this.floorType) {
      this.floorTexture?.dispose();
      this.floorTexture = createFloorTexture(room.floorType, this.context.renderer);
      this.floorMaterial!.map = this.floorTexture;
      this.floorMaterial!.needsUpdate = true;
      this.floorType = room.floorType;
    }

    const ground = this.context.ground;
    ground.position.y = this.groundDefaults.y + GROUND_LIFT_CM * this.context.worldPerCm;
    (ground.material as THREE.ShadowMaterial).opacity = ROOM_SHADOW_OPACITY;

    const studioFloor = this.context.scene.getObjectByName(STUDIO_FLOOR_NAME);
    if (studioFloor) studioFloor.visible = false;
  }

  dispose(): void {
    this.teardown();
  }

  private build(): void {
    const k = this.context.worldPerCm;
    const size = ROOM_SIZE_CM.floor * k;
    const wallHeight = ROOM_SIZE_CM.wallHeight * k;
    const half = size / 2;

    this.floorMaterial = new THREE.MeshStandardMaterial({ roughness: FLOOR_ROUGHNESS });
    this.wallMaterial = new THREE.MeshStandardMaterial({ roughness: WALL_ROUGHNESS });

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(size, size), this.floorMaterial);
    floor.rotation.x = -Math.PI / 2;

    const backWall = new THREE.Mesh(new THREE.PlaneGeometry(size, wallHeight), this.wallMaterial);
    backWall.position.set(0, wallHeight / 2, -half);
    backWall.receiveShadow = true;

    const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(size, wallHeight), this.wallMaterial);
    leftWall.position.set(-half, wallHeight / 2, 0);
    leftWall.rotation.y = Math.PI / 2;
    leftWall.receiveShadow = true;

    this.group = new THREE.Group();
    this.group.add(floor, backWall, leftWall);
    this.context.scene.add(this.group);
  }

  private teardown(): void {
    if (this.group) {
      this.context.scene.remove(this.group);
      this.group.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) (child as THREE.Mesh).geometry.dispose();
      });
      this.group = null;
    }
    this.floorMaterial?.dispose();
    this.wallMaterial?.dispose();
    this.floorTexture?.dispose();
    this.floorMaterial = null;
    this.wallMaterial = null;
    this.floorTexture = null;
    this.floorType = null;
    const ground = this.context.ground;
    ground.position.y = this.groundDefaults.y;
    (ground.material as THREE.ShadowMaterial).opacity = this.groundDefaults.opacity;

    const studioFloor = this.context.scene.getObjectByName(STUDIO_FLOOR_NAME);
    if (studioFloor) studioFloor.visible = true;
  }
}
