"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { MerchantAssetView } from "@/lib/assets/types";
import { roomsEqual, suggestWallColors, type RoomSettings } from "@/lib/scenes/room";
import { MAX_SCENE_ITEMS, type ResolvedScene } from "@/lib/scenes/types";
import type { BackdropMode } from "../backdrop";
import type { ViewerContext } from "../viewer-context";
import { RoomRenderer } from "../room/room-renderer";
import { AssetPanel } from "./asset-panel";
import { AssetRail } from "./asset-rail";
import {
  SceneController,
  type ControllerState,
  type EditorMode,
  type PlaceableAsset,
} from "./scene-controller";
import { RoomPanel } from "./room-panel";
import { SelectionToolbar } from "./selection-toolbar";
import { useMerchantAssets } from "./use-merchant-assets";

const DRAG_TYPE = "application/x-room-asset";

interface SceneEditorProps {
  productId: string;
  context: ViewerContext | null;
  backdrop: BackdropMode;
  initialScene: ResolvedScene;
  onSaved?: (scene: ResolvedScene) => void;
  onLoaded?: () => void;
}

function toPlaceable(asset: MerchantAssetView): PlaceableAsset {
  return {
    assetId: asset.id,
    versionId: asset.currentVersion.id,
    glbUrl: asset.currentVersion.glbUrl,
    widthCm: asset.currentVersion.widthCm,
    depthCm: asset.currentVersion.depthCm,
    heightCm: asset.currentVersion.heightCm,
  };
}

function isTyping(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  return !!element && (element.tagName === "INPUT" || element.tagName === "TEXTAREA" || element.isContentEditable);
}

export function SceneEditor({ productId, context, backdrop, initialScene, onSaved, onLoaded }: SceneEditorProps) {
  const { assets, categories, loading, error } = useMerchantAssets();
  const controllerRef = useRef<SceneController | null>(null);
  const [state, setState] = useState<ControllerState>({ selectedId: null, itemCount: 0, dirty: false });
  const [mode, setMode] = useState<EditorMode>("translate");
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [savedBackdrop, setSavedBackdrop] = useState(initialScene.backdrop);
  const [room, setRoom] = useState<RoomSettings | undefined>(initialScene.room);
  const [savedRoom, setSavedRoom] = useState<RoomSettings | undefined>(initialScene.room);
  const [roomOpen, setRoomOpen] = useState(false);
  const roomRendererRef = useRef<RoomRenderer | null>(null);
  const roomRef = useRef(room);
  const assetsById = useMemo(() => new Map(assets.map((a) => [a.id, a])), [assets]);
  const assetsByIdRef = useRef(assetsById);
  const initialSceneRef = useRef(initialScene);
  const onLoadedRef = useRef(onLoaded);

  useEffect(() => {
    onLoadedRef.current = onLoaded;
  }, [onLoaded]);

  useEffect(() => {
    initialSceneRef.current = initialScene;
  }, [initialScene]);

  useEffect(() => {
    assetsByIdRef.current = assetsById;
  }, [assetsById]);

  useEffect(() => {
    roomRef.current = room;
    roomRendererRef.current?.apply(room);
  }, [room]);

  useEffect(() => {
    if (!context) return;
    const renderer = new RoomRenderer(context);
    roomRendererRef.current = renderer;
    renderer.apply(roomRef.current);
    return () => {
      renderer.dispose();
      roomRendererRef.current = null;
    };
  }, [context]);

  useEffect(() => {
    if (!context) return;
    const controller = new SceneController(context, { onChange: setState });
    controllerRef.current = controller;
    void controller.load(initialSceneRef.current.items).finally(() => onLoadedRef.current?.());

    const dom = context.renderer.domElement;
    const onDragOver = (event: DragEvent) => {
      if (event.dataTransfer?.types.includes(DRAG_TYPE)) {
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
      }
    };
    const onDrop = (event: DragEvent) => {
      const assetId = event.dataTransfer?.getData(DRAG_TYPE);
      const asset = assetId ? assetsByIdRef.current.get(assetId) : undefined;
      if (!asset || asset.locked || asset.placement === "wall") return;
      event.preventDefault();
      controller.addAssetAtPointer(toPlaceable(asset), event.clientX, event.clientY);
    };
    dom.addEventListener("dragover", onDragOver);
    dom.addEventListener("drop", onDrop);

    return () => {
      dom.removeEventListener("dragover", onDragOver);
      dom.removeEventListener("drop", onDrop);
      controller.dispose();
      controllerRef.current = null;
    };
  }, [context]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTyping(event.target) || !controllerRef.current) return;
      if (event.key === "Delete" || event.key === "Backspace") controllerRef.current.removeSelected();
      if (event.key === "Escape") controllerRef.current.select(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const activeCategory = categories.find((c) => c.id === activeCategoryId) ?? null;
  const visibleAssets = assets.filter(
    (asset) =>
      asset.categoryId === activeCategoryId &&
      asset.name.toLowerCase().includes(search.trim().toLowerCase())
  );
  const atLimit = state.itemCount >= MAX_SCENE_ITEMS;
  const hasLockedItems = initialScene.items.some((item) => assetsById.get(item.assetId)?.locked);
  const dirty = state.dirty || backdrop !== savedBackdrop || !roomsEqual(room, savedRoom);
  const suggestions = useMemo(() => suggestWallColors(context?.productTone ?? null), [context]);

  const changeMode = (next: EditorMode) => {
    setMode(next);
    controllerRef.current?.setMode(next);
  };

  const save = async () => {
    const controller = controllerRef.current;
    if (!controller) return;
    setSaving(true);
    setSaveMessage(null);
    const revision = controller.revision;
    const backdropAtSave = backdrop;
    const roomAtSave = room;
    try {
      const res = await fetch(`/api/products/${productId}/scene`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schemaVersion: 1,
          backdrop: backdropAtSave,
          ...(roomAtSave ? { room: roomAtSave } : {}),
          items: controller.serialize(),
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Could not save scene");
      controller.markClean(revision);
      setSavedBackdrop(backdropAtSave);
      setSavedRoom(roomAtSave);
      onSaved?.(json.data);
      setSaveMessage({ text: "Scene saved", ok: true });
    } catch (err) {
      setSaveMessage({ text: err instanceof Error ? err.message : "Could not save scene", ok: false });
    } finally {
      setSaving(false);
    }
  };

  const startDrag = (asset: MerchantAssetView, event: React.DragEvent) => {
    event.dataTransfer.setData(DRAG_TYPE, asset.id);
    event.dataTransfer.effectAllowed = "copy";
  };

  return (
    <>
      <div className="absolute bottom-28 left-4 top-16 z-10 flex items-start gap-2 sm:bottom-16 sm:top-4">
        {loading ? (
          <p className="rounded-xl bg-white/95 px-3 py-2 text-xs text-stone-500 shadow-xs">Loading assets...</p>
        ) : error ? (
          <p className="rounded-xl bg-white/95 px-3 py-2 text-xs font-medium text-rose-600 shadow-xs">{error}</p>
        ) : (
          <>
            <AssetRail
              categories={categories}
              activeCategoryId={activeCategoryId}
              onSelectCategory={(id) => {
                setActiveCategoryId(id);
                setRoomOpen(false);
                setSearch("");
              }}
              roomActive={roomOpen}
              onOpenRoom={() => {
                setRoomOpen((open) => !open);
                setActiveCategoryId(null);
              }}
            />
            {roomOpen && (
              <RoomPanel room={room} suggestions={suggestions} onChange={setRoom} onClose={() => setRoomOpen(false)} />
            )}
            {activeCategory && (
              <AssetPanel
                assets={visibleAssets}
                categoryName={activeCategory.name}
                search={search}
                onSearch={setSearch}
                atLimit={atLimit}
                onClose={() => setActiveCategoryId(null)}
                onAdd={(asset) => controllerRef.current?.addAsset(toPlaceable(asset))}
                onDragStartAsset={startDrag}
              />
            )}
          </>
        )}
      </div>

      <div className="absolute bottom-16 right-4 z-10 flex flex-col items-end gap-2 sm:bottom-4">
        {state.selectedId && (
          <SelectionToolbar
            mode={mode}
            onModeChange={changeMode}
            onDelete={() => controllerRef.current?.removeSelected()}
          />
        )}
        {hasLockedItems && (
          <p className="max-w-64 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800 shadow-xs">
            Some items use assets you no longer have access to. You can remove them, but not add more copies.
          </p>
        )}
        {saveMessage && (
          <p
            className={`max-w-64 rounded-lg px-2.5 py-1.5 text-xs font-medium shadow-xs ${
              saveMessage.ok ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-700"
            }`}
          >
            {saveMessage.text}
          </p>
        )}
        <div className="flex items-center gap-2 rounded-xl border border-stone-200/90 bg-white/95 p-1 pl-3 shadow-xs backdrop-blur-md">
          <span className="text-xs font-medium text-stone-600">
            {state.itemCount}/{MAX_SCENE_ITEMS} items
          </span>
          <Button size="sm" className="h-8 text-xs" onClick={save} disabled={!dirty || saving}>
            {saving ? "Saving..." : "Save scene"}
          </Button>
        </div>
      </div>
    </>
  );
}
