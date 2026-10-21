"use client";

import React, { useState, useRef } from "react";
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
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { saveProductImageToIDB } from "@/lib/storage/indexeddb-storage";

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
    title: "1. Front Angle",
    description: "Direct head-on view of the furniture piece.",
    file: null,
    previewUrl: null,
    dataUrl: null,
  },
  back: {
    viewType: "back",
    title: "2. Back Angle",
    description: "Reverse perspective showing back detailing.",
    file: null,
    previewUrl: null,
    dataUrl: null,
  },
  left: {
    viewType: "left",
    title: "3. Left Side",
    description: "Full left profile view.",
    file: null,
    previewUrl: null,
    dataUrl: null,
  },
  right: {
    viewType: "right",
    title: "4. Right Side",
    description: "Full right profile view under identical lighting.",
    file: null,
    previewUrl: null,
    dataUrl: null,
  },
};

export default function CreateProductPage() {
  const router = useRouter();

  // Form State
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Chair");
  const [description, setDescription] = useState("");
  const [dimensionUnit, setDimensionUnit] = useState<"cm" | "mm">("cm");
  const [width, setWidth] = useState("85");
  const [depth, setDepth] = useState("75");
  const [height, setHeight] = useState("82");

  // Slots State
  const [slots, setSlots] = useState<Record<AngleView, ImageSlot>>(INITIAL_SLOTS);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Review & Generation State
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Handle Image Selection
  const handleFileSelect = (viewType: AngleView, file: File) => {
    // Validate format
    const validTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!validTypes.includes(file.type)) {
      setError(`Invalid file format for ${viewType}. Only JPEG, PNG, or WebP allowed.`);
      return;
    }

    // Validate size (max 20MB)
    if (file.size > 20 * 1024 * 1024) {
      setError(`File size exceeds 20MB limit.`);
      return;
    }

    setError(null);

    // Check duplicate file name across other slots
    const isDuplicate = Object.values(slots).some(
      (s) => s.viewType !== viewType && s.file && s.file.name === file.name && s.file.size === file.size
    );
    if (isDuplicate) {
      setDuplicateWarning(
        `Warning: You selected "${file.name}" for multiple angles. Ensure each angle is photographed from a distinct perspective.`
      );
    } else {
      setDuplicateWarning(null);
    }

    const previewUrl = URL.createObjectURL(file);

    // Convert to Data URI
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

  // Convert dimensions to normalized mm
  const normalizeDimension = (val: string): number => {
    const num = parseFloat(val);
    if (isNaN(num) || num <= 0) return 0;
    return dimensionUnit === "cm" ? num * 10 : num;
  };

  const widthMm = normalizeDimension(width);
  const depthMm = normalizeDimension(depth);
  const heightMm = normalizeDimension(height);

  const allImagesUploaded = Object.values(slots).every((s) => s.dataUrl !== null);

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
      setError("All 4 perspective photographs (Front, Back, Left, Right) are mandatory.");
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
      // Build 4 image payload
      const imagesPayload = (["front", "back", "left", "right"] as AngleView[]).map(
        (view) => {
          const slot = slots[view];
          return {
            viewType: view,
            publicUrl: slot.dataUrl!, // Pass Data URI directly to Meshy compatible pipeline
            fileName: slot.file?.name || `${view}.jpg`,
            mimeType: slot.file?.type || "image/jpeg",
            fileSizeBytes: slot.file?.size || 0,
          };
        }
      );

      // 1. Create product in backend
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
          images: imagesPayload,
        }),
      });

      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error || "Failed to create product");
      }

      const createdProduct = json.data;

      // 2. Cache images in IndexedDB for fast offline retrieval
      for (const view of ["front", "back", "left", "right"] as AngleView[]) {
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

      // 3. Trigger 3D generation
      const genRes = await fetch(`/api/products/${createdProduct.id}/generate`, {
        method: "POST",
      });
      const genJson = await genRes.json();
      if (!genJson.success) {
        console.warn("Generation initiated with warning:", genJson.error);
      }

      // 4. Redirect to 3D Viewer Studio
      router.push(`/viewer/${createdProduct.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Submission failed");
      setSubmitting(false);
    }
  };

  return (
    <DashboardLayout
      title="Create 3D Model"
      subtitle="Upload 4-angle product photographs to generate a textured 3D GLB model"
    >
      <form onSubmit={handleOpenReview} className="max-w-5xl space-y-8 pb-12">
        {/* Error Alert */}
        {error && (
          <div className="p-4 rounded-xl border border-rose-200 bg-rose-50 text-rose-800 text-sm flex items-center gap-3">
            <AlertCircle className="h-5 w-5 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        {/* Duplicate Angle Warning */}
        {duplicateWarning && (
          <div className="p-4 rounded-xl border border-amber-200 bg-amber-50 text-amber-800 text-sm flex items-center gap-3">
            <Info className="h-5 w-5 shrink-0 text-amber-600" />
            <span>{duplicateWarning}</span>
          </div>
        )}

        {/* Section 1: Product Specifications */}
        <Card className="border-stone-200/80 bg-white">
          <CardHeader>
            <CardTitle className="text-base font-semibold">
              1. Product Specifications
            </CardTitle>
            <CardDescription className="text-xs">
              Basic product identity and physical dimensions used for real-world scaling
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-stone-700">
                  Product Name <span className="text-rose-500">*</span>
                </label>
                <Input
                  required
                  placeholder="e.g. Modern Minimalist Armchair"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-stone-700">
                  Category <span className="text-rose-500">*</span>
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-stone-200 bg-white text-sm text-stone-800 focus:outline-none focus:ring-1 focus:ring-stone-900"
                >
                  <option value="Chair">Chair</option>
                  <option value="Sofa">Sofa</option>
                  <option value="Table">Table</option>
                  <option value="Bed">Bed</option>
                  <option value="Cabinet">Cabinet</option>
                  <option value="Home Decor">Home Decor</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-stone-700">
                Description (Optional)
              </label>
              <Textarea
                placeholder="Details on materials, finish, upholstery..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            </div>

            {/* Dimensions */}
            <div className="pt-2">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-stone-700">
                  Physical Dimensions <span className="text-rose-500">*</span>
                </label>
                <div className="inline-flex rounded-lg border border-stone-200 p-0.5 bg-stone-50 text-xs font-medium">
                  <button
                    type="button"
                    onClick={() => setDimensionUnit("cm")}
                    className={`px-2.5 py-1 rounded-md transition-colors ${
                      dimensionUnit === "cm"
                        ? "bg-white shadow-xs text-stone-900 font-semibold"
                        : "text-stone-500 hover:text-stone-800"
                    }`}
                  >
                    Centimeters (cm)
                  </button>
                  <button
                    type="button"
                    onClick={() => setDimensionUnit("mm")}
                    className={`px-2.5 py-1 rounded-md transition-colors ${
                      dimensionUnit === "mm"
                        ? "bg-white shadow-xs text-stone-900 font-semibold"
                        : "text-stone-500 hover:text-stone-800"
                    }`}
                  >
                    Millimeters (mm)
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <span className="text-[11px] text-stone-500">Width ({dimensionUnit})</span>
                  <Input
                    type="number"
                    min="1"
                    step="0.1"
                    required
                    value={width}
                    onChange={(e) => setWidth(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-[11px] text-stone-500">Depth ({dimensionUnit})</span>
                  <Input
                    type="number"
                    min="1"
                    step="0.1"
                    required
                    value={depth}
                    onChange={(e) => setDepth(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-[11px] text-stone-500">Height ({dimensionUnit})</span>
                  <Input
                    type="number"
                    min="1"
                    step="0.1"
                    required
                    value={height}
                    onChange={(e) => setHeight(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Section 2: Four-Angle Dedicated Upload Zones */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-stone-900">
                2. Four-Angle Photography
              </h2>
              <p className="text-xs text-stone-500">
                Photograph the product under consistent studio lighting against a clean background
              </p>
            </div>
            <span className="text-xs font-semibold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-md">
              {Object.values(slots).filter((s) => s.file !== null).length} of 4 angles uploaded
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {(["front", "back", "left", "right"] as AngleView[]).map((view) => {
              const slot = slots[view];
              return (
                <DropzoneSlot
                  key={view}
                  slot={slot}
                  onFileSelect={(file) => handleFileSelect(view, file)}
                  onRemove={() => handleRemoveImage(view)}
                />
              );
            })}
          </div>
        </div>

        {/* Primary CTA */}
        <div className="flex justify-end gap-3 pt-4 border-t border-stone-200">
          <Button
            type="submit"
            size="lg"
            disabled={!allImagesUploaded || !name.trim()}
            className="gap-2 px-8"
          >
            <span>Review & Generate 3D</span>
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </form>

      {/* Pre-Generation Review Modal */}
      {showReviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/60 backdrop-blur-xs">
          <Card className="max-w-2xl w-full p-6 bg-white space-y-6 shadow-2xl animate-in fade-in-50 zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-stone-200">
              <div>
                <h3 className="text-lg font-bold text-stone-900">
                  Review 3D Generation
                </h3>
                <p className="text-xs text-stone-500">
                  Confirm your product angles and Meshy AI generation parameters
                </p>
              </div>
              <button
                onClick={() => setShowReviewModal(false)}
                disabled={submitting}
                className="p-1 text-stone-400 hover:text-stone-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* 4 Angle Preview Grid */}
            <div className="grid grid-cols-4 gap-2">
              {(["front", "back", "left", "right"] as AngleView[]).map((v) => (
                <div key={v} className="space-y-1 text-center">
                  <div className="aspect-square rounded-lg border border-stone-200 overflow-hidden bg-stone-50">
                    {slots[v].previewUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={slots[v].previewUrl!}
                        alt={v}
                        className="h-full w-full object-cover"
                      />
                    )}
                  </div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-stone-600">
                    {v}
                  </span>
                </div>
              ))}
            </div>

            {/* Specs Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3 rounded-lg bg-stone-50 text-xs">
              <div>
                <span className="text-stone-400 block text-[11px]">Product</span>
                <span className="font-semibold text-stone-800">{name}</span>
              </div>
              <div>
                <span className="text-stone-400 block text-[11px]">Category</span>
                <span className="font-semibold text-stone-800">{category}</span>
              </div>
              <div>
                <span className="text-stone-400 block text-[11px]">Dimensions</span>
                <span className="font-semibold text-stone-800">
                  {widthMm / 10} × {depthMm / 10} × {heightMm / 10} cm
                </span>
              </div>
              <div>
                <span className="text-stone-400 block text-[11px]">AI Geometry</span>
                <span className="font-semibold text-stone-800">Standard PBR</span>
              </div>
              <div>
                <span className="text-stone-400 block text-[11px]">Texture Resolution</span>
                <span className="font-semibold text-stone-800">2K (2048 × 2048)</span>
              </div>
              <div>
                <span className="text-stone-400 block text-[11px]">Estimated Cost</span>
                <span className="font-bold text-amber-700">20 Demo Credits</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setShowReviewModal(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirmAndGenerate}
                disabled={submitting}
                className="gap-2 min-w-[170px]"
              >
                {submitting ? (
                  <>
                    <Sparkles className="h-4 w-4 animate-spin" />
                    <span>Initiating...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    <span>Generate 3D Model</span>
                  </>
                )}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </DashboardLayout>
  );
}

// ---------------------------------------------------------------------------
// Dedicated Dropzone Slot Component
// ---------------------------------------------------------------------------
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
    <Card
      className={`relative overflow-hidden border-2 transition-all flex flex-col justify-between ${
        slot.previewUrl
          ? "border-emerald-300/80 bg-emerald-50/20"
          : isDragOver
          ? "border-stone-900 bg-stone-50"
          : "border-dashed border-stone-200 bg-white hover:border-stone-400"
      }`}
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
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFileSelect(file);
        }}
      />

      <div className="p-3 border-b border-stone-100 flex items-center justify-between">
        <span className="text-xs font-bold text-stone-900">{slot.title}</span>
        {slot.previewUrl && (
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
        )}
      </div>

      <div className="p-4 flex-1 flex flex-col items-center justify-center min-h-[170px]">
        {slot.previewUrl ? (
          <div className="relative w-full aspect-square rounded-lg overflow-hidden border border-stone-200 bg-stone-100 group">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={slot.previewUrl}
              alt={slot.title}
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-stone-950/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="h-7 text-xs"
                onClick={() => inputRef.current?.click()}
              >
                Replace
              </Button>
              <Button
                type="button"
                size="sm"
                variant="destructive"
                className="h-7 text-xs"
                onClick={onRemove}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>
        ) : (
          <div
            onClick={() => inputRef.current?.click()}
            className="cursor-pointer text-center space-y-2 p-2 hover:scale-[1.02] transition-transform"
          >
            <div className="h-10 w-10 rounded-full bg-stone-100 text-stone-500 mx-auto flex items-center justify-center">
              <Upload className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-stone-800">
                Click or drag image
              </p>
              <p className="text-[10px] text-stone-400 mt-0.5">
                PNG, JPG, WebP up to 20MB
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="p-2.5 bg-stone-50/70 border-t border-stone-100 text-[11px] text-stone-500 text-center">
        {slot.description}
      </div>
    </Card>
  );
}
