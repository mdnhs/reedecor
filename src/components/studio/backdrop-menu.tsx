"use client";

import type { CSSProperties } from "react";
import { Check } from "lucide-react";
import {
  PRESET_GROUP_LABELS,
  STUDIO_PRESETS,
  presetPreviewGradient,
  type BackdropMode,
  type PresetGroup,
} from "@/lib/scenes/backdrops";

interface BackdropMenuProps {
  value: BackdropMode;
  onSelect: (mode: BackdropMode) => void;
}

interface Tile {
  mode: BackdropMode;
  label: string;
  preview: CSSProperties;
}

const QUICK_TILES: Tile[] = [
  { mode: "auto", label: "Auto", preview: { background: "linear-gradient(135deg, #f5f5f4, #a8a29e)" } },
  { mode: "white", label: "White", preview: { background: "#ffffff" } },
  { mode: "studio", label: "Grey", preview: { background: "linear-gradient(to bottom, hsl(0 0% 70%), hsl(0 0% 79%))" } },
  {
    mode: "transparent",
    label: "Clear",
    preview: { background: "repeating-conic-gradient(#e7e5e4 0% 25%, #ffffff 0% 50%) 50% / 12px 12px" },
  },
];

const GROUPS: PresetGroup[] = ["light", "colour", "dark"];

function presetTiles(group: PresetGroup): Tile[] {
  return STUDIO_PRESETS.filter((preset) => preset.group === group).map((preset) => ({
    mode: preset.mode,
    label: preset.label,
    preview: { background: presetPreviewGradient(preset.mode) },
  }));
}

function TileButton({ tile, active, onSelect }: { tile: Tile; active: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={active}
      aria-label={tile.label}
      onClick={onSelect}
      className="flex flex-col items-center gap-1 rounded-lg p-1 text-xs text-stone-700 hover:bg-stone-100"
    >
      <span
        style={tile.preview}
        className={`relative flex h-10 w-full items-center justify-center rounded-md border ${
          active ? "border-stone-900 ring-2 ring-stone-900/30" : "border-stone-200"
        }`}
      >
        {active && <Check className="h-3.5 w-3.5 text-stone-900 mix-blend-difference" />}
      </span>
      <span className="w-full truncate text-center">{tile.label}</span>
    </button>
  );
}

export function BackdropMenu({ value, onSelect }: BackdropMenuProps) {
  return (
    <div
      role="menu"
      className="absolute right-0 top-full mt-2 w-72 space-y-2 rounded-xl border border-stone-200/90 bg-white p-2 shadow-md"
    >
      <div className="grid grid-cols-4 gap-1">
        {QUICK_TILES.map((tile) => (
          <TileButton key={tile.mode} tile={tile} active={value === tile.mode} onSelect={() => onSelect(tile.mode)} />
        ))}
      </div>
      {GROUPS.map((group) => (
        <div key={group} className="space-y-1">
          <p className="px-1 text-xs font-semibold text-stone-500">{PRESET_GROUP_LABELS[group]}</p>
          <div className="grid grid-cols-4 gap-1">
            {presetTiles(group).map((tile) => (
              <TileButton key={tile.mode} tile={tile} active={value === tile.mode} onSelect={() => onSelect(tile.mode)} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
