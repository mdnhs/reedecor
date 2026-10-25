"use client";

import { Lock, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { MerchantAssetView } from "@/lib/assets/types";

interface AssetPanelProps {
  assets: MerchantAssetView[];
  categoryName: string;
  search: string;
  onSearch: (value: string) => void;
  atLimit: boolean;
  onClose: () => void;
  onAdd: (asset: MerchantAssetView) => void;
  onDragStartAsset: (asset: MerchantAssetView, event: React.DragEvent) => void;
}

function tileNote(asset: MerchantAssetView, atLimit: boolean): string | null {
  if (asset.locked) return "Locked";
  if (asset.placement === "wall") return "Wall items are coming soon";
  if (atLimit) return "Scene is full (20 items)";
  return null;
}

export function AssetPanel({
  assets,
  categoryName,
  search,
  onSearch,
  atLimit,
  onClose,
  onAdd,
  onDragStartAsset,
}: AssetPanelProps) {
  return (
    <section
      aria-label={`${categoryName} assets`}
      className="flex max-h-full w-56 flex-col gap-2 overflow-hidden rounded-xl border border-stone-200/90 bg-white/95 p-3 shadow-md backdrop-blur-md"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold text-stone-900">{categoryName}</h3>
        <button
          type="button"
          onClick={onClose}
          title="Close panel"
          className="rounded-md p-1 text-stone-400 hover:text-stone-900"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-stone-400" />
        <Input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search assets"
          className="h-8 pl-8 text-xs"
        />
      </div>

      <div className="grid grid-cols-2 gap-2 overflow-y-auto">
        {assets.length === 0 && (
          <p className="col-span-2 py-4 text-center text-xs text-stone-400">No assets here.</p>
        )}
        {assets.map((asset) => {
          const note = tileNote(asset, atLimit);
          const disabled = note !== null;
          return (
            <button
              key={asset.id}
              type="button"
              disabled={disabled}
              draggable={!disabled}
              onClick={() => onAdd(asset)}
              onDragStart={(event) => onDragStartAsset(asset, event)}
              title={note ?? `Add ${asset.name}`}
              className="group relative flex flex-col gap-1 rounded-lg border border-stone-200 bg-stone-50 p-1.5 text-left transition-colors enabled:hover:border-stone-900 disabled:opacity-60"
            >
              <div className="flex aspect-square items-center justify-center overflow-hidden rounded-md bg-white">
                {asset.currentVersion.previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={asset.currentVersion.previewUrl}
                    alt={asset.name}
                    draggable={false}
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <span className="text-xs text-stone-300">No preview</span>
                )}
              </div>
              <span className="truncate text-xs font-medium text-stone-800">{asset.name}</span>
              {note && <span className="text-xs text-stone-500">{note}</span>}
              {asset.locked && <Lock className="absolute right-2 top-2 h-3.5 w-3.5 text-stone-500" />}
            </button>
          );
        })}
      </div>
    </section>
  );
}
