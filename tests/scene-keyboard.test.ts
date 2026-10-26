import { describe, it, expect } from "vitest";
import { shouldHandleSceneKey } from "../src/components/studio/scene-editor/keyboard";

const target = (tagName: string, isContentEditable = false) => ({ tagName, isContentEditable }) as unknown as EventTarget;

describe("shouldHandleSceneKey", () => {
  it("handles keys pressed on the page or the canvas", () => {
    expect(shouldHandleSceneKey(target("BODY"))).toBe(true);
    expect(shouldHandleSceneKey(target("CANVAS"))).toBe(true);
    expect(shouldHandleSceneKey(null)).toBe(true);
  });

  it("leaves keys to focused form controls, buttons and links", () => {
    for (const tag of ["INPUT", "TEXTAREA", "SELECT", "BUTTON", "A"]) {
      expect(shouldHandleSceneKey(target(tag))).toBe(false);
    }
    expect(shouldHandleSceneKey(target("DIV", true))).toBe(false);
  });
});
