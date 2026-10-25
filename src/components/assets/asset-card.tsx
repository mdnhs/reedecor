"use client";

import { useState } from "react";
import { Eye, EyeOff, Layers, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import type { AssetAccessLevel, AssetCategory, AssetPlacement, RoomAsset } from "@/lib/assets/types";
import { assetFetch, errorText, type MerchantOption } from "./api";
import { AccessFields } from "./access-fields";
import { SizeFields } from "./size-fields";
import { sizeIsValid, useGlbPicker } from "./use-glb-picker";

interface AssetCardProps {
  asset: RoomAsset;
  categories: AssetCategory[];
  merchants: MerchantOption[];
  onChanged: () => void;
  onError: (message: string) => void;
}

const LEVEL_LABEL: Record<AssetAccessLevel, string> = {
  free: "Free",
  pro: "Pro",
  selected: "Selected",
};

export function AssetCard({ asset, categories, merchants, onChanged, onError }: AssetCardProps) {
  const [panel, setPanel] = useState<"none" | "edit" | "version">("none");
  const [name, setName] = useState(asset.name);
  const [categoryId, setCategoryId] = useState(asset.categoryId);
  const [placement, setPlacement] = useState<AssetPlacement>(asset.placement);
  const [level, setLevel] = useState<AssetAccessLevel>(asset.accessLevel);
  const [allowed, setAllowed] = useState<string[]>(asset.allowedMerchantIds);
  const [busy, setBusy] = useState(false);
  const picker = useGlbPicker();

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await action();
      setPanel("none");
      onChanged();
    } catch (err) {
      onError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const patch = (body: object) =>
    assetFetch(`/api/admin/assets/${asset.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

  const saveEdits = () =>
    run(() =>
      patch({
        name,
        categoryId,
        placement,
        accessLevel: level,
        allowedMerchantIds: level === "selected" ? allowed : [],
      })
    );

  const toggleHidden = () => run(() => patch({ hidden: !asset.hidden }));

  const uploadVersion = () =>
    run(async () => {
      if (!picker.file) return;
      const form = new FormData();
      form.set("glb", picker.file);
      if (picker.previewBlob) form.set("preview", new File([picker.previewBlob], "preview.png", { type: "image/png" }));
      form.set(
        "meta",
        JSON.stringify({
          widthCm: Number(picker.size.width),
          depthCm: Number(picker.size.depth),
          heightCm: Number(picker.size.height),
        })
      );
      await assetFetch(`/api/admin/assets/${asset.id}/versions`, { method: "POST", body: form });
      picker.reset();
    });

  const category = categories.find((c) => c.id === asset.categoryId);
  const { currentVersion } = asset;

  return (
    <Card className={`overflow-hidden ${asset.hidden ? "opacity-60" : ""}`}>
      <div className="flex aspect-video items-center justify-center bg-stone-100">
        {currentVersion.previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={currentVersion.previewUrl} alt={asset.name} className="h-full w-full object-contain" />
        ) : (
          <span className="text-xs text-stone-400">No preview</span>
        )}
      </div>

      <div className="space-y-3 p-4">
        <div className="space-y-1.5">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-bold text-stone-900">{asset.name}</h3>
            <Badge variant={asset.accessLevel === "free" ? "secondary" : "default"} className="text-xs">
              {LEVEL_LABEL[asset.accessLevel]}
            </Badge>
          </div>
          <p className="text-xs text-stone-500">
            {category?.name ?? "Uncategorised"} · {asset.placement} · v{currentVersion.version} ·{" "}
            {currentVersion.widthCm}×{currentVersion.depthCm}×{currentVersion.heightCm} cm
          </p>
          {asset.hidden && <p className="text-xs font-semibold text-amber-700">Hidden from merchants</p>}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setPanel(panel === "edit" ? "none" : "edit")}>
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setPanel(panel === "version" ? "none" : "version")}>
            <Layers className="h-3.5 w-3.5" />
            New version
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={toggleHidden} disabled={busy}>
            {asset.hidden ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
            {asset.hidden ? "Unhide" : "Hide"}
          </Button>
        </div>

        {panel === "edit" && (
          <div className="space-y-3 border-t border-stone-200 pt-3">
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
            <div className="grid grid-cols-2 gap-2">
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="h-9 rounded-lg border border-stone-200 bg-white px-2.5 text-sm text-stone-800"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <select
                value={placement}
                onChange={(e) => setPlacement(e.target.value as AssetPlacement)}
                className="h-9 rounded-lg border border-stone-200 bg-white px-2.5 text-sm text-stone-800"
              >
                <option value="floor">Floor</option>
                <option value="wall">Wall</option>
              </select>
            </div>
            <AccessFields
              level={level}
              allowed={allowed}
              merchants={merchants}
              onLevelChange={setLevel}
              onAllowedChange={setAllowed}
            />
            <Button size="sm" onClick={saveEdits} disabled={busy || !name.trim()}>
              Save changes
            </Button>
          </div>
        )}

        {panel === "version" && (
          <div className="space-y-3 border-t border-stone-200 pt-3">
            <label className="block text-xs font-medium text-stone-600">
              New GLB file
              <Input type="file" accept=".glb,model/gltf-binary" onChange={(e) => picker.pick(e.target.files?.[0] ?? null)} />
            </label>
            {picker.error && <p className="text-xs font-medium text-rose-600">{picker.error}</p>}
            {picker.previewUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={picker.previewUrl} alt="New version preview" className="h-24 w-full rounded-lg bg-stone-100 object-contain" />
            )}
            <SizeFields value={picker.size} onChange={picker.setSize} />
            <Button
              size="sm"
              onClick={uploadVersion}
              disabled={busy || picker.rendering || !picker.file || !sizeIsValid(picker.size)}
            >
              {busy ? "Uploading..." : `Upload as v${currentVersion.version + 1}`}
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}
