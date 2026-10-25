"use client";

import { Input } from "@/components/ui/input";

export interface SizeValues {
  width: string;
  depth: string;
  height: string;
}

export function SizeFields({ value, onChange }: { value: SizeValues; onChange: (next: SizeValues) => void }) {
  const field = (key: keyof SizeValues, label: string) => (
    <label className="space-y-1 text-xs font-medium text-stone-600">
      {label}
      <Input
        type="number"
        min="1"
        max="1000"
        step="0.1"
        value={value[key]}
        onChange={(e) => onChange({ ...value, [key]: e.target.value })}
      />
    </label>
  );

  return (
    <div className="grid grid-cols-3 gap-2">
      {field("width", "Width (cm)")}
      {field("depth", "Depth (cm)")}
      {field("height", "Height (cm)")}
    </div>
  );
}
