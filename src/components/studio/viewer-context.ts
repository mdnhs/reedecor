import type * as THREE from "three";
import type { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { ProductTone } from "./backdrop";

export interface ViewerContext {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
  container: HTMLElement;
  worldPerCm: number;
  ground: THREE.Mesh;
  productTone: ProductTone | null;
}
