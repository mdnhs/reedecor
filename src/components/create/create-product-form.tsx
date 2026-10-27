"use client";

import React, { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Upload,
  X,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  Info,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { saveProductImageToIDB } from "@/lib/storage/indexeddb-storage";
import { useAuth } from "@/lib/auth/auth-context";
import { FormSkeleton } from "@/components/ui/skeleton-patterns";
import { useFeature, useFeatures } from "@/lib/features/features-context";
import { featureOffMessage } from "@/lib/features/catalog";
import { ShieldAlert, Store } from "lucide-react";

type AngleView = "front" | "back" | "left" | "right";

interface ImageSlot {
  viewType: AngleView;
  title: string;
  description: string;
  file: File | null;
  previewUrl: string | null;
  dataUrl: string | null;
}

const INITIAL_SLOTS: Record<AngleView, ImageSlot> = {
  front: {
    viewType: "front",
    title: "Front",
    description: "Direct head-on view of the furniture piece.",
    file: null,
    previewUrl: null,
    dataUrl: null,
  },
  back: {
    viewType: "back",
    title: "Back",
    description: "Reverse perspective showing back detailing.",
    file: null,
    previewUrl: null,
    dataUrl: null,
  },
  left: {
    viewType: "left",
    title: "Left",
    description: "Full left profile view.",
    file: null,
    previewUrl: null,
    dataUrl: null,
  },
  right: {
    viewType: "right",
    title: "Right",
    description: "Full right profile view under identical lighting.",
    file: null,
    previewUrl: null,
    dataUrl: null,
  },
};

export type GenerationMode = "image_to_3d" | "multi_image_to_3d";

export function CreateProductForm({ mode }: { mode: GenerationMode }) {
  const router = useRouter();
  const { isCustomer, demoMode, switchDemoRole } = useAuth();
  const generationOn = useFeature("model_generation");
  const { loaded: featuresLoaded } = useFeatures();

  // Form State
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Chair");
  const [description, setDescription] = useState("");
  const [priceBdt, setPriceBdt] = useState("");
  const [dimensionUnit, setDimensionUnit] = useState<"cm" | "mm">("cm");
  const [width, setWidth] = useState("");
  const [depth, setDepth] = useState("");
  const [height, setHeight] = useState("");

  const generationMode = mode;

  // Slots State
  const [slots, setSlots] = useState<Record<AngleView, ImageSlot>>(INITIAL_SLOTS);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Review & Generation State
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [creditInfo, setCreditInfo] = useState<{ remaining: number; single: number; multi: number } | null>(null);

  useEffect(() => {
    if (isCustomer) return;
    let ignore = false;
    fetch("/api/credits/usage")
      .then((res) => res.json())
      .then((json) => {
        if (!ignore && json.success) {
          setCreditInfo({
            remaining: json.data.remaining,
            single: json.data.singleImageCost,
            multi: json.data.multiImageCost,
          });
        }
      })
      .catch(() => {});
    return () => {
      ignore = true;
    };
  }, [isCustomer]);

  // Handle Image Selection
  const handleFileSelect = (viewType: AngleView, file: File) => {
    const validTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!validTypes.includes(file.type)) {
      setError(`Invalid file format for ${viewType}. Only JPEG, PNG, or WebP allowed.`);
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError(`File size exceeds 10MB limit.`);
      return;
    }

    setError(null);

    const isDuplicate = Object.values(slots).some(
      (s) => s.viewType !== viewType && s.file && s.file.name === file.name && s.file.size === file.size
    );
    if (isDuplicate && generationMode === "multi_image_to_3d") {
      setDuplicateWarning(
        `Notice: "${file.name}" is chosen for multiple views. Make sure each photo captures a distinct perspective.`
      );
    } else {
      setDuplicateWarning(null);
    }

    const previewUrl = URL.createObjectURL(file);

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setSlots((prev) => ({
        ...prev,
        [viewType]: {
          ...prev[viewType],
          file,
          previewUrl,
          dataUrl,
        },
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = (viewType: AngleView) => {
    if (slots[viewType].previewUrl) {
      URL.revokeObjectURL(slots[viewType].previewUrl!);
    }
    setSlots((prev) => ({
      ...prev,
      [viewType]: {
        ...prev[viewType],
        file: null,
        previewUrl: null,
        dataUrl: null,
      },
    }));
  };

  const normalizeDimension = (val: string): number => {
    const num = parseFloat(val);
    if (isNaN(num) || num <= 0) return 0;
    return dimensionUnit === "cm" ? num * 10 : num;
  };

  const widthMm = normalizeDimension(width);
  const depthMm = normalizeDimension(depth);
  const heightMm = normalizeDimension(height);

  const allImagesUploaded =
    generationMode === "image_to_3d"
      ? slots.front.dataUrl !== null
      : Object.values(slots).every((s) => s.dataUrl !== null);

  const photoTotal = generationMode === "image_to_3d" ? 1 : 4;
  const photoCount = generationMode === "image_to_3d" ? (slots.front.dataUrl ? 1 : 0) : Object.values(slots).filter((s) => s.dataUrl).length;
  const missingHint = !allImagesUploaded
    ? `Add ${photoTotal - photoCount} more ${photoTotal - photoCount === 1 ? "photo" : "photos"} to continue.`
    : !name.trim()
    ? "Enter a product name to continue."
    : null;

  const handleOpenReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Please enter a product name.");
      return;
    }
    if (widthMm <= 0 || depthMm <= 0 || heightMm <= 0) {
      setError("Please enter valid positive dimensions for width, depth, and height.");
      return;
    }
    if (!allImagesUploaded) {
      if (generationMode === "image_to_3d") {
        setError("Please upload a primary product photograph for Image to 3D generation.");
      } else {
        setError("All 4 perspective photographs (Front, Back, Left, Right) are mandatory for Multi-Image to 3D.");
      }
      return;
    }
    setError(null);
    setShowReviewModal(true);
  };

  const handleConfirmAndGenerate = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError(null);

    try {
      const viewsToInclude: AngleView[] =
        generationMode === "image_to_3d"
          ? ["front"]
          : (["front", "back", "left", "right"] as AngleView[]);

      const imagesPayload = viewsToInclude.map((view) => {
        const slot = slots[view];
        return {
          viewType: view,
          publicUrl: slot.dataUrl!,
          fileName: slot.file?.name || `${view}.jpg`,
          mimeType: slot.file?.type || "image/jpeg",
          fileSizeBytes: slot.file?.size || 0,
        };
      });

      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          category,
          description: description.trim() || undefined,
          widthMm,
          depthMm,
          heightMm,
          priceBdt: parseFloat(priceBdt) > 0 ? parseFloat(priceBdt) : undefined,
          generationMode,
          images: imagesPayload,
        }),
      });

      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error || "Failed to create product");
      }

      const createdProduct = json.data;

      // Cache images in IndexedDB
      for (const view of viewsToInclude) {
        const slot = slots[view];
        if (slot.file) {
          await saveProductImageToIDB(
            createdProduct.id,
            view,
            slot.file,
            slot.file.name,
            slot.file.type
          );
        }
      }

      // Trigger 3D generation
      await fetch(`/api/products/${createdProduct.id}/generate`, {
        method: "POST",
      });

      // Redirect to 3D Viewer Studio
      router.push(`/viewer/${createdProduct.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Submission failed");
      setSubmitting(false);
    }
  };

  if (!featuresLoaded) {
    return <FormSkeleton />;
  }

  if (!generationOn) {
    return (
      <Card className="max-w-lg mx-auto my-12 border-stone-200 bg-stone-50 text-center p-8 space-y-3">
        <ShieldAlert className="h-7 w-7 mx-auto text-stone-500" />
        <h2 className="text-lg font-bold text-stone-900">3D model generation is turned off</h2>
        <p className="text-xs text-stone-600">{featureOffMessage} Existing models can still be viewed.</p>
      </Card>
    );
  }

  if (isCustomer) {
    return (
      <Card className="max-w-lg mx-auto my-12 border-amber-200 bg-amber-50/50 text-center p-8 space-y-5">
        <div className="h-14 w-14 rounded-2xl bg-amber-100 text-amber-800 mx-auto flex items-center justify-center">
          <ShieldAlert className="h-7 w-7" />
        </div>
        <div className="space-y-2">
          <h2 className="text-lg font-bold text-stone-900">
            Customer Account (View Only)
          </h2>
          <p className="text-xs text-stone-600">
            Customer accounts have view-only access to browse the interactive 3D catalog and inspect product dimensions. Uploading 4-angle photographs and generating 3D models via Meshy AI requires a <strong>Merchant</strong> or <strong>SaaS Admin</strong> account.
          </p>
        </div>
        <div className="pt-2 flex items-center justify-center gap-3">
          {demoMode && (
          <Button
            onClick={() => switchDemoRole("merchant")}
            className="gap-2 bg-amber-700 hover:bg-amber-800 text-white shadow-xs"
          >
            <Store className="h-4 w-4" />
            <span>Switch to Merchant Account</span>
          </Button>
          )}
          <Button
            variant="outline"
            onClick={() => router.push("/products")}
            className="text-xs"
          >
            Browse Catalog
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <>
      <form onSubmit={handleOpenReview} className="mx-auto max-w-3xl space-y-8 pb-12">
        {error && (
          <div role="alert" className="flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}
        {duplicateWarning && (
          <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <Info className="h-4 w-4 shrink-0 text-amber-600" />
            <span>{duplicateWarning}</span>
          </div>
        )}

        <section className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="font-display text-lg font-bold text-stone-900">
                {generationMode === "image_to_3d" ? "Add a photo" : "Add four photos"}
              </h2>
              <p className="text-sm text-stone-500">
                {generationMode === "image_to_3d"
                  ? "One clear photo on a plain background works best."
                  : "Same lighting and camera height, turning 90° each time."}
              </p>
            </div>
            <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold text-stone-600">
              {photoCount} of {photoTotal} added
            </span>
          </div>

          {generationMode === "image_to_3d" ? (
            <div className="max-w-xs">
              <DropzoneSlot
                slot={{ ...slots.front, title: "Product photo" }}
                onFileSelect={(file) => handleFileSelect("front", file)}
                onRemove={() => handleRemoveImage("front")}
              />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {(["front", "back", "left", "right"] as AngleView[]).map((view) => (
                <DropzoneSlot
                  key={view}
                  slot={slots[view]}
                  onFileSelect={(file) => handleFileSelect(view, file)}
                  onRemove={() => handleRemoveImage(view)}
                />
              ))}
            </div>
          )}

          <Link
            href={generationMode === "image_to_3d" ? "/create/multi" : "/create/single"}
            className="inline-block text-xs font-semibold text-amber-800 hover:underline"
          >
            {generationMode === "image_to_3d" ? "Have more angles? Use 4 photos instead" : "Only have one photo? Use a single photo instead"}
          </Link>
        </section>

        <section className="space-y-4">
          <h2 className="font-display text-lg font-bold text-stone-900">Product details</h2>

          <Field id="product-name" label="Name">
            <Input
              id="product-name"
              required
              placeholder="e.g. Modern Minimalist Armchair"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field id="product-category" label="Category">
              <select
                id="product-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="h-9 w-full rounded-lg border border-stone-200 bg-white px-3 text-sm text-stone-800 shadow-2xs focus:outline-none focus:ring-1 focus:ring-stone-900"
              >
                {["Chair", "Sofa", "Table", "Bed", "Cabinet", "Home Decor", "Other"].map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>
            <Field id="product-price" label="Price (BDT)">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-stone-500">৳</span>
                <Input
                  id="product-price"
                  type="number"
                  required
                  min="100"
                  placeholder="32500"
                  value={priceBdt}
                  onChange={(e) => setPriceBdt(e.target.value)}
                  className="pl-7"
                />
              </div>
            </Field>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-stone-700" id="dimensions-label">
                Size
              </span>
              <div className="inline-flex rounded-lg bg-stone-100 p-0.5 text-xs font-medium" role="group" aria-label="Unit">
                {(["cm", "mm"] as const).map((unit) => (
                  <button
                    key={unit}
                    type="button"
                    aria-pressed={dimensionUnit === unit}
                    onClick={() => setDimensionUnit(unit)}
                    className={`rounded-md px-3 py-1 transition-colors ${
                      dimensionUnit === unit ? "bg-white font-semibold text-stone-900 shadow-2xs" : "text-stone-500 hover:text-stone-800"
                    }`}
                  >
                    {unit}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3" role="group" aria-labelledby="dimensions-label">
              {[
                { id: "dim-width", label: "Width", value: width, set: setWidth },
                { id: "dim-depth", label: "Depth", value: depth, set: setDepth },
                { id: "dim-height", label: "Height", value: height, set: setHeight },
              ].map((dim) => (
                <div key={dim.id}>
                  <label htmlFor={dim.id} className="sr-only">
                    {dim.label} ({dimensionUnit})
                  </label>
                  <Input
                    id={dim.id}
                    type="number"
                    min="1"
                    step="0.1"
                    required
                    placeholder={dim.label}
                    value={dim.value}
                    onChange={(e) => dim.set(e.target.value)}
                  />
                </div>
              ))}
            </div>
            <p className="text-xs text-stone-400">Real-world size, used to scale the 3D model correctly.</p>
          </div>

          <Field id="product-description" label="Description" optional>
            <Textarea
              id="product-description"
              placeholder="Materials, finish, upholstery…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </Field>
        </section>

        <div className="flex flex-col-reverse items-stretch gap-3 border-t border-stone-200 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-stone-500">{missingHint ?? "Ready to generate."}</p>
          <Button
            type="submit"
            size="lg"
            disabled={missingHint !== null}
            className="gap-2 bg-stone-900 px-8 font-semibold text-white hover:bg-stone-800"
          >
            <span>Review & generate</span>
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </form>

      {showReviewModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/40 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="review-title"
          onKeyDown={(e) => {
            if (e.key === "Escape" && !submitting) setShowReviewModal(false);
          }}
        >
          <Card className="w-full max-w-lg space-y-5 rounded-2xl border border-stone-200 bg-white p-6 shadow-2xl">
            <div>
              <h3 id="review-title" className="font-display text-lg font-bold text-stone-900">
                Ready to generate?
              </h3>
              <p className="text-sm text-stone-500">Check the details, then start. This uses AI credits.</p>
            </div>

            <div className={`grid gap-2 ${generationMode === "image_to_3d" ? "max-w-24 grid-cols-1" : "grid-cols-4"}`}>
              {(generationMode === "image_to_3d" ? (["front"] as AngleView[]) : (["front", "back", "left", "right"] as AngleView[])).map((v) => (
                <div key={v} className="aspect-square overflow-hidden rounded-xl border border-stone-200 bg-stone-100">
                  {slots[v].previewUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={slots[v].previewUrl!} alt={`${v} photo`} className="h-full w-full object-cover" />
                  )}
                </div>
              ))}
            </div>

            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl bg-stone-50 p-4 text-sm">
              <div>
                <dt className="text-xs text-stone-400">Product</dt>
                <dd className="font-semibold text-stone-800">{name}</dd>
              </div>
              <div>
                <dt className="text-xs text-stone-400">Category</dt>
                <dd className="font-semibold text-stone-800">{category}</dd>
              </div>
              <div>
                <dt className="text-xs text-stone-400">Size</dt>
                <dd className="font-semibold text-stone-800">
                  {widthMm / 10} × {depthMm / 10} × {heightMm / 10} cm
                </dd>
              </div>
              <div>
                <dt className="text-xs text-stone-400">Cost</dt>
                <dd className="font-semibold text-amber-700">
                  {creditInfo
                    ? `${generationMode === "image_to_3d" ? creditInfo.single : creditInfo.multi} credits (${creditInfo.remaining} left)`
                    : "—"}
                </dd>
              </div>
            </dl>

            <div className="flex items-center justify-end gap-3">
              <Button variant="outline" onClick={() => setShowReviewModal(false)} disabled={submitting}>
                Back
              </Button>
              <Button
                onClick={handleConfirmAndGenerate}
                disabled={submitting}
                autoFocus
                className="min-w-40 gap-2 bg-stone-900 font-semibold text-white hover:bg-stone-800"
              >
                <Sparkles className={`h-4 w-4 ${submitting ? "animate-spin" : ""}`} />
                <span>{submitting ? "Starting…" : "Generate 3D model"}</span>
              </Button>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}

function Field({
  id,
  label,
  optional,
  children,
}: {
  id: string;
  label: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium text-stone-700">
        {label}
        {optional && <span className="ml-1 font-normal text-stone-400">(optional)</span>}
      </label>
      {children}
    </div>
  );
}

function DropzoneSlot({
  slot,
  onFileSelect,
  onRemove,
}: {
  slot: ImageSlot;
  onFileSelect: (file: File) => void;
  onRemove: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  return (
    <div className="space-y-1.5">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        aria-label={`${slot.title} photo`}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFileSelect(file);
          e.target.value = "";
        }}
      />

      {slot.previewUrl ? (
        <div className="aspect-square overflow-hidden rounded-2xl border border-stone-200 bg-stone-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={slot.previewUrl} alt={slot.title} className="h-full w-full object-cover" />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragOver(false);
            const file = e.dataTransfer.files?.[0];
            if (file) onFileSelect(file);
          }}
          className={`flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed text-center transition-colors ${
            isDragOver ? "border-amber-500 bg-amber-50" : "border-stone-200 bg-white hover:border-stone-400"
          }`}
        >
          <Upload className="h-5 w-5 text-stone-400" />
          <span className="text-xs font-medium text-stone-600">Tap or drop</span>
          <span className="text-xs text-stone-400">JPG, PNG, WebP</span>
        </button>
      )}

      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1 font-semibold text-stone-700">
          {slot.previewUrl && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />}
          {slot.title}
        </span>
        {slot.previewUrl && (
          <span className="flex items-center gap-2">
            <button type="button" onClick={() => inputRef.current?.click()} className="font-medium text-stone-500 hover:text-stone-900">
              Replace
            </button>
            <button type="button" onClick={onRemove} aria-label={`Remove ${slot.title} photo`} className="text-stone-400 hover:text-rose-600">
              <X className="h-3.5 w-3.5" />
            </button>
          </span>
        )}
      </div>
    </div>
  );
}
