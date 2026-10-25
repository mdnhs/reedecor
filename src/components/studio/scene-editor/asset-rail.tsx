"use client";

import { Home } from "lucide-react";
import { CategoryIcon } from "@/components/assets/category-icon";
import type { AssetCategory } from "@/lib/assets/types";

interface AssetRailProps {
  categories: AssetCategory[];
  activeCategoryId: string | null;
  onSelectCategory: (id: string | null) => void;
  onOpenRoom?: () => void;
  roomActive?: boolean;
}

export function AssetRail({ categories, activeCategoryId, onSelectCategory, onOpenRoom, roomActive }: AssetRailProps) {
  return (
    <nav
      aria-label="Asset categories"
      className="flex flex-col items-center gap-1 rounded-xl border border-stone-200/90 bg-white/95 p-1 shadow-xs backdrop-blur-md"
    >
      {categories.map((category) => {
        const active = category.id === activeCategoryId;
        return (
          <button
            key={category.id}
            type="button"
            title={category.name}
            aria-label={category.name}
            aria-pressed={active}
            onClick={() => onSelectCategory(active ? null : category.id)}
            className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${
              active ? "bg-stone-900 text-white" : "text-stone-600 hover:bg-stone-100"
            }`}
          >
            <CategoryIcon icon={category.icon} className="h-4 w-4" />
          </button>
        );
      })}
      {onOpenRoom && (
        <>
          <div className="my-0.5 h-px w-6 bg-stone-200" />
          <button
            type="button"
            title="Room"
            aria-label="Room"
            aria-pressed={!!roomActive}
            onClick={onOpenRoom}
            className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${
              roomActive ? "bg-stone-900 text-white" : "text-stone-600 hover:bg-stone-100"
            }`}
          >
            <Home className="h-4 w-4" />
          </button>
        </>
      )}
    </nav>
  );
}
