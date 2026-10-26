import { describe, it, expect, vi } from "vitest";
import * as THREE from "three";
import { disposeModel } from "../src/components/studio/scene/item-loader";

describe("disposeModel", () => {
  it("releases geometry, materials and their textures", () => {
    const texture = new THREE.Texture();
    const material = new THREE.MeshStandardMaterial({ map: texture });
    const geometry = new THREE.BoxGeometry();
    const root = new THREE.Group().add(new THREE.Mesh(geometry, material));
    const spies = [vi.spyOn(texture, "dispose"), vi.spyOn(material, "dispose"), vi.spyOn(geometry, "dispose")];

    disposeModel(root);

    spies.forEach((spy) => expect(spy).toHaveBeenCalled());
  });
});
