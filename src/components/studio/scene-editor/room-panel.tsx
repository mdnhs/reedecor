"use client";

import { X } from "lucide-react";
import {
  DEFAULT_ROOM,
  FLOOR_TYPES,
  NEUTRAL_WALL_COLORS,
  type FloorType,
  type RoomSettings,
} from "@/lib/scenes/room";

interface RoomPanelProps {
  room: RoomSettings | undefined;
  suggestions: string[];
  onChange: (room: RoomSettings) => void;
  onClose: () => void;
}

const FLOOR_LABELS: Record<FloorType, { name: string; swatch: string }> = {
  oak: { name: "Oak", swatch: "#c9a06a" },
  walnut: { name: "Walnut", swatch: "#5e4333" },
  concrete: { name: "Concrete", swatch: "#b4b4b1" },
  tile: { name: "Tile", swatch: "#f1f1ee" },
};

function Swatch({ color, label, active, onPick }: { color: string; label: string; active: boolean; onPick: () => void }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      onClick={onPick}
      style={{ backgroundColor: color }}
      className={`h-7 w-7 rounded-full border transition-shadow ${
        active ? "border-stone-900 ring-2 ring-stone-900/40" : "border-stone-300 hover:ring-2 hover:ring-stone-300"
      }`}
    />
  );
}

export function RoomPanel({ room, suggestions, onChange, onClose }: RoomPanelProps) {
  const current = room ?? DEFAULT_ROOM;
  const enabled = room?.enabled ?? false;
  const update = (patch: Partial<RoomSettings>) => onChange({ ...current, ...patch });

  return (
    <section
      aria-label="Room"
      className="flex max-h-full w-56 flex-col gap-3 overflow-y-auto rounded-xl border border-stone-200/90 bg-white/95 p-3 shadow-md backdrop-blur-md"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold text-stone-900">Room</h3>
        <button type="button" onClick={onClose} title="Close panel" className="rounded-md p-1 text-stone-400 hover:text-stone-900">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <label className="flex items-center justify-between text-xs font-medium text-stone-700">
        Show room
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={() => onChange({ ...current, enabled: !enabled })}
          className={`relative h-5 w-9 rounded-full transition-colors ${enabled ? "bg-stone-900" : "bg-stone-300"}`}
        >
          <span
            className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${enabled ? "left-4.5" : "left-0.5"}`}
          />
        </button>
      </label>

      <div className={`space-y-3 ${enabled ? "" : "pointer-events-none opacity-50"}`}>
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-stone-600">Suggested for this product</p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((color) => (
              <Swatch key={color} color={color} label={`Wall ${color}`} active={current.wallColor.toLowerCase() === color} onPick={() => update({ wallColor: color })} />
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-stone-600">Wall colour</p>
          <div className="flex flex-wrap items-center gap-2">
            {NEUTRAL_WALL_COLORS.map((neutral) => (
              <Swatch
                key={neutral.color}
                color={neutral.color}
                label={neutral.name}
                active={current.wallColor.toLowerCase() === neutral.color}
                onPick={() => update({ wallColor: neutral.color })}
              />
            ))}
            <input
              type="color"
              aria-label="Custom wall colour"
              value={current.wallColor}
              onChange={(e) => update({ wallColor: e.target.value })}
              className="h-7 w-7 cursor-pointer rounded-full border border-stone-300 bg-transparent p-0"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-stone-600">Floor</p>
          <div className="grid grid-cols-2 gap-2">
            {FLOOR_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                aria-pressed={current.floorType === type}
                onClick={() => update({ floorType: type })}
                className={`flex items-center gap-2 rounded-lg border p-1.5 text-xs font-medium text-stone-700 transition-colors ${
                  current.floorType === type ? "border-stone-900 bg-stone-50" : "border-stone-200 hover:border-stone-400"
                }`}
              >
                <span className="h-5 w-5 shrink-0 rounded-md border border-stone-200" style={{ backgroundColor: FLOOR_LABELS[type].swatch }} />
                {FLOOR_LABELS[type].name}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
