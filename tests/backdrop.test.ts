import { describe, it, expect } from "vitest";
import { resolvePalette } from "../src/components/studio/backdrop";

const WHITE = "hsl(0 0% 100%)";

describe("resolvePalette", () => {
  it("makes the white backdrop pure white from top to bottom with no darker edge", () => {
    expect(resolvePalette("white", null)).toEqual({ top: WHITE, floor: WHITE, edge: WHITE });
    expect(resolvePalette("white", { h: 0.04, s: 0.7, l: 0.4 })).toEqual({
      top: WHITE,
      floor: WHITE,
      edge: WHITE,
    });
  });

  it("keeps the studio grey gradient darker at the top and edges", () => {
    const palette = resolvePalette("studio", null);
    expect(palette.top).not.toBe(palette.floor);
    expect(palette.edge).not.toBe(WHITE);
  });

  it("keeps the auto backdrop tinted by the product when a tone is known", () => {
    const palette = resolvePalette("auto", { h: 0.04, s: 0.7, l: 0.4 });
    expect(palette.top).not.toBe(WHITE);
  });
});
