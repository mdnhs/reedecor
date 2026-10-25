export interface BackdropPalette {
  top: string;
  floor: string;
  edge: string;
  spot?: { color: string; alpha: number };
  grain?: boolean;
}

export type PresetGroup = "light" | "colour" | "dark";

export interface StudioPreset {
  mode: "ivory" | "sand" | "blush" | "sage" | "mocha" | "slate" | "charcoal" | "midnight";
  label: string;
  group: PresetGroup;
  h: number;
  s: number;
  l: number;
}

export const STUDIO_PRESETS: StudioPreset[] = [
  { mode: "ivory", label: "Ivory", group: "light", h: 0.11, s: 0.35, l: 0.93 },
  { mode: "sand", label: "Sand", group: "light", h: 0.1, s: 0.3, l: 0.82 },
  { mode: "blush", label: "Blush", group: "light", h: 0.02, s: 0.28, l: 0.84 },
  { mode: "sage", label: "Sage", group: "colour", h: 0.3, s: 0.14, l: 0.72 },
  { mode: "mocha", label: "Mocha", group: "colour", h: 0.07, s: 0.22, l: 0.48 },
  { mode: "slate", label: "Slate", group: "colour", h: 0.59, s: 0.14, l: 0.58 },
  { mode: "charcoal", label: "Charcoal", group: "dark", h: 0.6, s: 0.04, l: 0.17 },
  { mode: "midnight", label: "Midnight", group: "dark", h: 0.62, s: 0.45, l: 0.14 },
];

export const BACKDROP_MODES = [
  "auto",
  "studio",
  "white",
  "transparent",
  ...STUDIO_PRESETS.map((preset) => preset.mode),
] as const;

export type BackdropMode = (typeof BACKDROP_MODES)[number];

export const PRESET_GROUP_LABELS: Record<PresetGroup, string> = {
  light: "Light",
  colour: "Colour",
  dark: "Dark",
};

export function isBackdropMode(value: string): value is BackdropMode {
  return (BACKDROP_MODES as readonly string[]).includes(value);
}

export function hslCss(h: number, s: number, l: number): string {
  const clamp = (v: number) => Math.min(1, Math.max(0, v));
  return `hsl(${Math.round((((h % 1) + 1) % 1) * 360)} ${Math.round(clamp(s) * 100)}% ${Math.round(clamp(l) * 100)}%)`;
}

const DARK_LIGHTNESS = 0.3;

export function studioPresetPalette({ h, s, l }: Pick<StudioPreset, "h" | "s" | "l">): BackdropPalette {
  const dark = l < DARK_LIGHTNESS;
  return {
    top: hslCss(h, s, l - (dark ? 0.04 : 0.06)),
    floor: hslCss(h, s, l + (dark ? 0.06 : 0.05)),
    edge: hslCss(h, s, l - (dark ? 0.12 : 0.22)),
    spot: { color: hslCss(h, s * 0.7, Math.min(0.97, l + (dark ? 0.28 : 0.2))), alpha: dark ? 0.55 : 0.4 },
    grain: true,
  };
}

export function presetPreviewGradient(mode: StudioPreset["mode"]): string {
  const preset = STUDIO_PRESETS.find((p) => p.mode === mode)!;
  const palette = studioPresetPalette(preset);
  return `linear-gradient(to bottom, ${palette.top}, ${palette.floor})`;
}
