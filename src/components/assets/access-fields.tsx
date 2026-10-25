"use client";

import type { AssetAccessLevel } from "@/lib/assets/types";
import type { MerchantOption } from "./api";

const LEVELS: { value: AssetAccessLevel; label: string }[] = [
  { value: "free", label: "Free (all merchants)" },
  { value: "pro", label: "Pro plan merchants" },
  { value: "selected", label: "Selected merchants" },
];

interface AccessFieldsProps {
  level: AssetAccessLevel;
  allowed: string[];
  merchants: MerchantOption[];
  onLevelChange: (level: AssetAccessLevel) => void;
  onAllowedChange: (ids: string[]) => void;
}

export function AccessFields({ level, allowed, merchants, onLevelChange, onAllowedChange }: AccessFieldsProps) {
  const toggle = (id: string) =>
    onAllowedChange(allowed.includes(id) ? allowed.filter((m) => m !== id) : [...allowed, id]);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-3">
        {LEVELS.map((option) => (
          <label key={option.value} className="flex items-center gap-1.5 text-xs font-medium text-stone-700">
            <input
              type="radio"
              checked={level === option.value}
              onChange={() => onLevelChange(option.value)}
            />
            {option.label}
          </label>
        ))}
      </div>
      {level === "selected" && (
        <div className="max-h-32 space-y-1 overflow-y-auto rounded-lg border border-stone-200 p-2">
          {merchants.length === 0 && <p className="text-xs text-stone-400">No merchants found.</p>}
          {merchants.map((merchant) => (
            <label key={merchant.id} className="flex items-center gap-2 text-xs text-stone-700">
              <input
                type="checkbox"
                checked={allowed.includes(merchant.id)}
                onChange={() => toggle(merchant.id)}
              />
              {merchant.name}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
