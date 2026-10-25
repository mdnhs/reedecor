"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ASSET_CATEGORY_ICONS, type AssetCategory, type AssetCategoryIcon } from "@/lib/assets/types";
import { assetFetch, errorText } from "./api";
import { CategoryIcon } from "./category-icon";

interface CategoryManagerProps {
  categories: AssetCategory[];
  onChanged: () => void;
  onError: (message: string) => void;
}

export function CategoryManager({ categories, onChanged, onError }: CategoryManagerProps) {
  const [name, setName] = useState("");
  const [icon, setIcon] = useState<AssetCategoryIcon>("shapes");
  const [busy, setBusy] = useState(false);

  const addCategory = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await assetFetch("/api/admin/asset-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, icon }),
      });
      setName("");
      onChanged();
    } catch (err) {
      onError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const removeCategory = async (id: string) => {
    try {
      await assetFetch(`/api/admin/asset-categories/${id}`, { method: "DELETE" });
      onChanged();
    } catch (err) {
      onError(errorText(err));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Categories</CardTitle>
        <CardDescription className="text-xs">
          Merchants browse assets by category in the studio rail.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {categories.length === 0 && (
            <p className="text-xs text-stone-400">No categories yet. Add one before uploading assets.</p>
          )}
          {categories.map((category) => (
            <span
              key={category.id}
              className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-white py-1 pl-2.5 pr-1 text-xs font-medium text-stone-700"
            >
              <CategoryIcon icon={category.icon} className="h-3.5 w-3.5" />
              {category.name}
              <button
                type="button"
                onClick={() => removeCategory(category.id)}
                className="rounded-full p-1 text-stone-400 hover:text-rose-600"
                title={`Delete ${category.name}`}
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="New category name"
            className="max-w-56"
          />
          <select
            value={icon}
            onChange={(e) => setIcon(e.target.value as AssetCategoryIcon)}
            className="h-9 rounded-lg border border-stone-200 bg-white px-2.5 text-xs font-medium text-stone-800"
          >
            {ASSET_CATEGORY_ICONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <Button size="sm" className="gap-1.5" onClick={addCategory} disabled={busy || !name.trim()}>
            <Plus className="h-3.5 w-3.5" />
            Add category
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
