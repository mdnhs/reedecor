import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { createContactShadow, disposeContactShadow } from "../src/components/studio/contact-shadow";

describe("contact shadow generator", () => {
  it("returns null for empty objects with no geometry", () => {
    const emptyGroup = new THREE.Group();
    const shadow = createContactShadow(emptyGroup);
    expect(shadow).toBeNull();
  });

  it("creates a grounded contact shadow mesh for a 3D model", () => {
    const group = new THREE.Group();
    // Simulate a model with 4 small legs resting on y = 0
    const legGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.5);
    const legMat = new THREE.MeshBasicMaterial();
    const positions = [
      [-0.4, 0.25, -0.4],
      [0.4, 0.25, -0.4],
      [-0.4, 0.25, 0.4],
      [0.4, 0.25, 0.4],
    ];

    positions.forEach(([x, y, z]) => {
      const leg = new THREE.Mesh(legGeo, legMat);
      leg.position.set(x, y, z);
      group.add(leg);
    });

    const shadow = createContactShadow(group);
    expect(shadow).toBeDefined();
    if (shadow) {
      expect(shadow.name).toBe("__contact_shadow__");
      expect(shadow.position.y).toBeCloseTo(0.001, 3);
      expect(shadow.renderOrder).toBe(2);
      expect(shadow.geometry).toBeInstanceOf(THREE.PlaneGeometry);
      expect((shadow.material as THREE.MeshBasicMaterial).transparent).toBe(true);
      expect((shadow.material as THREE.MeshBasicMaterial).depthWrite).toBe(false);
    }
  });

  it("cleans up resources and detaches from parent on disposeContactShadow", () => {
    const group = new THREE.Group();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
    mesh.position.y = 0.5;
    group.add(mesh);

    const scene = new THREE.Scene();
    scene.add(group);

    const shadow = createContactShadow(group);
    if (shadow) {
      scene.add(shadow);
      expect(scene.getObjectByName("__contact_shadow__")).toBe(shadow);

      disposeContactShadow(shadow);
      expect(scene.getObjectByName("__contact_shadow__")).toBeUndefined();
    }
  });
});
