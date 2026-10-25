"use client";

import { useState } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { AssetAccessLevel, AssetCategory, AssetPlacement } from "@/lib/assets/types";
import { assetFetch, errorText, type MerchantOption } from "./api";
import { AccessFields } from "./access-fields";
import { SizeFields } from "./size-fields";
import { sizeIsValid, useGlbPicker } from "./use-glb-picker";

interface AssetUploadFormProps {
  categories: AssetCategory[];
  merchants: MerchantOption[];
  onCreated: () => void;
  onError: (message: string) => void;
}

export function AssetUploadForm({ categories, merchants, onCreated, onError }: AssetUploadFormProps) {
  const picker = useGlbPicker();
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [placement, setPlacement] = useState<AssetPlacement>("floor");
  const [level, setLevel] = useState<AssetAccessLevel>("free");
  const [allowed, setAllowed] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const activeCategory = categoryId || categories[0]?.id || "";
  const ready = !!picker.file && !!name.trim() && !!activeCategory && sizeIsValid(picker.size);

  const submit = async () => {
    if (!picker.file || !ready) return;
    setSubmitting(true);
    try {
      const form = new FormData();
      form.set("glb", picker.file);
      if (picker.previewBlob) form.set("preview", new File([picker.previewBlob], "preview.png", { type: "image/png" }));
      form.set(
        "meta",
        JSON.stringify({
          name,
          categoryId: activeCategory,
          accessLevel: level,
          placement,
          widthCm: Number(picker.size.width),
          depthCm: Number(picker.size.depth),
          heightCm: Number(picker.size.height),
          allowedMerchantIds: level === "selected" ? allowed : [],
        })
      );
      await assetFetch("/api/admin/assets", { method: "POST", body: form });
      setName("");
      setAllowed([]);
      setLevel("free");
      picker.reset();
      onCreated();
    } catch (err) {
      onError(errorText(err));
    } finally {
      setSubmitting(false);
    }
  };

  const onPreviewOverride = (file: File | null) => {
    if (file) picker.setPreview(file);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Upload asset</CardTitle>
        <CardDescription className="text-xs">
          GLB only, under 2 MB after optimization. Textures up to 1k are recommended.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <div className="flex aspect-square items-center justify-center overflow-hidden rounded-xl border border-dashed border-stone-300 bg-stone-50 text-xs text-stone-400">
            {picker.previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={picker.previewUrl} alt="Asset preview" className="h-full w-full object-contain" />
            ) : picker.rendering ? (
              "Rendering preview..."
            ) : (
              "Preview appears here"
            )}
          </div>
          <label className="block text-xs font-medium text-stone-600">
            Replace preview (optional PNG)
            <Input type="file" accept="image/png" onChange={(e) => onPreviewOverride(e.target.files?.[0] ?? null)} />
          </label>
        </div>

        <div className="space-y-3 md:col-span-2">
          <label className="block text-xs font-medium text-stone-600">
            GLB file
            <Input type="file" accept=".glb,model/gltf-binary" onChange={(e) => picker.pick(e.target.files?.[0] ?? null)} />
          </label>
          {picker.error && <p className="text-xs font-medium text-rose-600">{picker.error}</p>}

          <div className="grid gap-2 sm:grid-cols-3">
            <label className="space-y-1 text-xs font-medium text-stone-600 sm:col-span-1">
              Name
              <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
            </label>
            <label className="space-y-1 text-xs font-medium text-stone-600">
              Category
              <select
                value={activeCategory}
                onChange={(e) => setCategoryId(e.target.value)}
                className="h-9 w-full rounded-lg border border-stone-200 bg-white px-2.5 text-sm text-stone-800"
              >
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-xs font-medium text-stone-600">
              Placement
              <select
                value={placement}
                onChange={(e) => setPlacement(e.target.value as AssetPlacement)}
                className="h-9 w-full rounded-lg border border-stone-200 bg-white px-2.5 text-sm text-stone-800"
              >
                <option value="floor">Floor</option>
                <option value="wall">Wall</option>
              </select>
            </label>
          </div>

          <SizeFields value={picker.size} onChange={picker.setSize} />
          <AccessFields
            level={level}
            allowed={allowed}
            merchants={merchants}
            onLevelChange={setLevel}
            onAllowedChange={setAllowed}
          />

          <Button className="gap-2" onClick={submit} disabled={!ready || submitting || picker.rendering}>
            <Upload className="h-4 w-4" />
            {submitting ? "Uploading..." : "Upload asset"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
