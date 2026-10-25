"use client";

import { Move, RotateCw, Scaling, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { EditorMode } from "./scene-controller";

interface SelectionToolbarProps {
  mode: EditorMode;
  onModeChange: (mode: EditorMode) => void;
  onDelete: () => void;
}

const MODES: { value: EditorMode; label: string; icon: typeof Move }[] = [
  { value: "translate", label: "Move", icon: Move },
  { value: "rotate", label: "Rotate", icon: RotateCw },
  { value: "scale", label: "Scale", icon: Scaling },
];

export function SelectionToolbar({ mode, onModeChange, onDelete }: SelectionToolbarProps) {
  return (
    <div
      role="toolbar"
      aria-label="Selected item"
      className="flex items-center gap-1 rounded-xl border border-stone-200/90 bg-white/95 p-1 shadow-xs backdrop-blur-md"
    >
      {MODES.map(({ value, label, icon: Icon }) => (
        <Button
          key={value}
          size="sm"
          variant={mode === value ? "default" : "ghost"}
          className="h-8 gap-1.5 px-2.5 text-xs"
          onClick={() => onModeChange(value)}
          aria-pressed={mode === value}
        >
          <Icon className="h-3.5 w-3.5" />
          {label}
        </Button>
      ))}
      <div className="h-4 w-px bg-stone-200" />
      <Button
        size="sm"
        variant="ghost"
        className="h-8 gap-1.5 px-2.5 text-xs text-rose-600 hover:text-rose-700"
        onClick={onDelete}
      >
        <Trash2 className="h-3.5 w-3.5" />
        Delete
      </Button>
    </div>
  );
}
