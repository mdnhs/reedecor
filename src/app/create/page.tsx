"use client";

import React, { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Upload,
  X,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  Info,
  Lightbulb,
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { saveProductImageToIDB } from "@/lib/storage/indexeddb-storage";
import { useAuth } from "@/lib/auth/auth-context";
import { Skeleton } from "@/components/ui/skeleton";
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
  const { isCustomer, demoMode, switchDemoRole } = useAuth();
  const generationOn = useFeature("model_generation");
  const { loaded: featuresLoaded } = useFeatures();

  // Form State
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Chair");
  const [description, setDescription] = useState("");
  const [priceBdt, setPriceBdt] = useState("");
  const [dimensionUnit, setDimensionUnit] = useState<"cm" | "mm">("cm");
  const [width, setWidth] = useState("85");
  const [depth, setDepth] = useState("75");
  const [height, setHeight] = useState("82");

  // 3D Generation Pipeline Option: Image to 3D vs Multi-Image to 3D
  const [generationMode, setGenerationMode] = useState<"image_to_3d" | "multi_image_to_3d">("multi_image_to_3d");

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
    return (
      <DashboardLayout title="Create 3D Model" subtitle="Loading">
        <Skeleton className="mx-auto my-12 h-64 w-full max-w-lg" />
      </DashboardLayout>
    );
  }

  if (!generationOn) {
    return (
      <DashboardLayout
        title="Create 3D Model — Turned Off"
        subtitle="3D model generation is currently unavailable"
      >
        <Card className="max-w-lg mx-auto my-12 border-stone-200 bg-stone-50 text-center p-8 space-y-3">
          <ShieldAlert className="h-7 w-7 mx-auto text-stone-500" />
          <h2 className="text-lg font-bold text-stone-900">3D model generation is turned off</h2>
          <p className="text-xs text-stone-600">{featureOffMessage} Existing models can still be viewed.</p>
        </Card>
      </DashboardLayout>
    );
  }

  if (isCustomer) {
    return (
      <DashboardLayout
        title="Create 3D Model — Access Restricted"
        subtitle="Merchant account required to initiate 3D reconstructions"
      >
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
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="Create 3D Model"
      subtitle="Upload 4-angle product photographs to generate a textured 3D GLB model"
    >
      <form onSubmit={handleOpenReview} className="max-w-5xl space-y-8 pb-12">
        {/* Error Alert */}
        {error && (
          <div className="p-4 rounded-xl border border-rose-200 bg-rose-50/80 text-rose-800 text-sm flex items-center gap-3">
            <AlertCircle className="h-5 w-5 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        {/* Duplicate Angle Warning */}
        {duplicateWarning && (
          <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/80 text-amber-800 text-sm flex items-center gap-3">
            <Info className="h-5 w-5 shrink-0 text-amber-600" />
            <span>{duplicateWarning}</span>
          </div>
        )}

        {/* Section 1: Product Specifications */}
        <Card className="border-stone-200/80 bg-white studio-card-shadow rounded-2xl">
          <CardHeader className="border-b border-stone-100 pb-4">
            <CardTitle className="text-base font-bold font-display text-stone-900">
              1. Product Identity & Dimensions
            </CardTitle>
            <CardDescription className="text-xs text-stone-500">
              Provide product details and real-world dimensions used for accurate 3D WebGL scaling
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="space-y-1.5 md:col-span-1">
                <label className="text-xs font-bold text-stone-700">
                  Product Name <span className="text-rose-500">*</span>
                </label>
                <Input
                  required
                  placeholder="e.g. Modern Minimalist Armchair"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="bg-white border-stone-200/90 shadow-2xs"
                />
              </div>

              <div className="space-y-1.5 md:col-span-1">
                <label className="text-xs font-bold text-stone-700">
                  Category <span className="text-rose-500">*</span>
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-stone-200/90 bg-white text-sm text-stone-800 shadow-2xs focus:outline-none focus:ring-1 focus:ring-stone-900"
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

              <div className="space-y-1.5 md:col-span-1">
                <label className="text-xs font-bold text-stone-700 flex items-center justify-between">
                  <span>Purchase Price (BDT ৳) <span className="text-rose-500">*</span></span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-stone-500">৳</span>
                  <Input
                    type="number"
                    required
                    min="100"
                    placeholder="e.g. 32500"
                    value={priceBdt}
                    onChange={(e) => setPriceBdt(e.target.value)}
                    className="bg-white border-stone-200/90 pl-7 shadow-2xs font-mono font-semibold"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-stone-700">
                Description (Optional)
              </label>
              <Textarea
                placeholder="Details on materials, finish, upholstery..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="bg-white border-stone-200/90 shadow-2xs"
              />
            </div>

            {/* Dimensions */}
            <div className="pt-2">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-stone-700">
                  Physical Dimensions <span className="text-rose-500">*</span>
                </label>
                <div className="inline-flex rounded-lg border border-stone-200 p-0.5 bg-stone-100 text-xs font-medium">
                  <button
                    type="button"
                    onClick={() => setDimensionUnit("cm")}
                    className={`px-3 py-1 rounded-md transition-all ${
                      dimensionUnit === "cm"
                        ? "bg-white shadow-2xs text-stone-900 font-bold"
                        : "text-stone-500 hover:text-stone-800"
                    }`}
                  >
                    Centimeters (cm)
                  </button>
                  <button
                    type="button"
                    onClick={() => setDimensionUnit("mm")}
                    className={`px-3 py-1 rounded-md transition-all ${
                      dimensionUnit === "mm"
                        ? "bg-white shadow-2xs text-stone-900 font-bold"
                        : "text-stone-500 hover:text-stone-800"
                    }`}
                  >
                    Millimeters (mm)
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <span className="text-xs font-medium text-stone-500">Width ({dimensionUnit})</span>
                  <Input
                    type="number"
                    min="1"
                    step="0.1"
                    required
                    value={width}
                    onChange={(e) => setWidth(e.target.value)}
                    className="bg-white border-stone-200/90"
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-xs font-medium text-stone-500">Depth ({dimensionUnit})</span>
                  <Input
                    type="number"
                    min="1"
                    step="0.1"
                    required
                    value={depth}
                    onChange={(e) => setDepth(e.target.value)}
                    className="bg-white border-stone-200/90"
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-xs font-medium text-stone-500">Height ({dimensionUnit})</span>
                  <Input
                    type="number"
                    min="1"
                    step="0.1"
                    required
                    value={height}
                    onChange={(e) => setHeight(e.target.value)}
                    className="bg-white border-stone-200/90"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Section 2: Generation Mode & Dedicated Upload Zones */}
        <div className="space-y-5">
          {/* Pipeline Mode Switcher */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-stone-200/90 studio-card-shadow">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-700" />
                <h3 className="text-sm font-bold text-stone-900 font-display">
                  2. Choose 3D Generation Pipeline
                </h3>
              </div>
              <p className="text-xs text-stone-500 mt-0.5">
                Select between single photograph AI depth estimation or full 4-angle multi-view reconstruction
              </p>
            </div>

            {/* Toggle Segmented Switcher */}
            <div className="flex items-center p-1 bg-stone-100 rounded-xl border border-stone-200/70 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setGenerationMode("image_to_3d")}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  generationMode === "image_to_3d"
                    ? "bg-white text-stone-900 shadow-xs border border-stone-200/60"
                    : "text-stone-600 hover:text-stone-900"
                }`}
              >
                <Upload className="w-3.5 h-3.5 text-amber-600" />
                <span>Image to 3D (1 Photo)</span>
              </button>

              <button
                type="button"
                onClick={() => setGenerationMode("multi_image_to_3d")}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  generationMode === "multi_image_to_3d"
                    ? "bg-white text-stone-900 shadow-xs border border-stone-200/60"
                    : "text-stone-600 hover:text-stone-900"
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                <span>Multi Image to 3D (4 Angles)</span>
              </button>
            </div>
          </div>

          {/* Mode Header & Upload Status */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h4 className="text-sm font-bold text-stone-900">
                {generationMode === "image_to_3d"
                  ? "Single Product Photograph Upload"
                  : "Four-Angle Multi-Perspective Photography"}
              </h4>
              <p className="text-xs text-stone-500">
                {generationMode === "image_to_3d"
                  ? "Upload a clean, well-lit photograph of the furniture piece against a plain background"
                  : "Photograph the product under consistent studio lighting from all four cardinal angles"}
              </p>
            </div>
            <span className="text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200/70 px-3 py-1 rounded-full self-start sm:self-auto">
              {generationMode === "image_to_3d"
                ? `${slots.front.file !== null ? "1 of 1" : "0 of 1"} photo uploaded`
                : `${Object.values(slots).filter((s) => s.file !== null).length} of 4 angles uploaded`}
            </span>
          </div>

          {/* Photography Best Practice Hint */}
          <div className="p-3.5 rounded-xl border border-stone-200/80 bg-stone-50/60 flex items-center gap-3 text-xs text-stone-600">
            <Lightbulb className="h-4 w-4 text-amber-600 shrink-0" />
            <span>
              {generationMode === "image_to_3d" ? (
                <>
                  <strong>Single Image Tip:</strong> Best results are achieved with 3/4 or direct perspective in high-contrast neutral lighting without obstructions.
                </>
              ) : (
                <>
                  <strong>Multi-Angle Tip:</strong> Place the furniture on a clean, neutral floor. Keep the camera height constant while rotating 90° around the object for true 360° geometry.
                </>
              )}
            </span>
          </div>

          {/* Upload Dropzones */}
          {generationMode === "image_to_3d" ? (
            <div className="max-w-md mx-auto">
              <DropzoneSlot
                slot={{
                  ...slots.front,
                  title: "Primary Product Photo",
                  description: "Direct view of the furniture piece in natural or studio lighting.",
                }}
                onFileSelect={(file) => handleFileSelect("front", file)}
                onRemove={() => handleRemoveImage("front")}
              />
            </div>
          ) : (
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
          )}
        </div>

        {/* Primary CTA */}
        <div className="flex justify-end gap-3 pt-4 border-t border-stone-200">
          <Button
            type="submit"
            size="lg"
            disabled={!allImagesUploaded || !name.trim()}
            className="gap-2 px-8 bg-stone-900 hover:bg-stone-800 text-white shadow-xs font-bold"
          >
            <span>Review & Generate 3D</span>
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </form>

      {/* Pre-Generation Review Modal */}
      {showReviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/40 backdrop-blur-xs">
          <Card className="max-w-2xl w-full p-6 bg-white space-y-6 shadow-2xl rounded-2xl border border-stone-200 animate-in fade-in-50 zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-stone-100">
              <div>
                <h3 className="text-lg font-bold text-stone-900 font-display">
                  Review 3D Model Generation
                </h3>
                <p className="text-xs text-stone-500">
                  {generationMode === "image_to_3d"
                    ? "Confirm single photograph and Meshy Image-to-3D parameters"
                    : "Confirm your 4 product angles and Meshy Multi-Image parameters"}
                </p>
              </div>
              <button
                onClick={() => setShowReviewModal(false)}
                disabled={submitting}
                className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Image Preview Grid */}
            {generationMode === "image_to_3d" ? (
              <div className="max-w-xs mx-auto text-center space-y-1.5">
                <div className="aspect-square rounded-xl border border-stone-200 overflow-hidden bg-stone-100 shadow-2xs">
                  {slots.front.previewUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={slots.front.previewUrl}
                      alt="Primary Product"
                      className="h-full w-full object-cover"
                    />
                  )}
                </div>
                <span className="text-xs font-bold uppercase tracking-wider text-stone-600">
                  Primary Photo (Image to 3D)
                </span>
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-2.5">
                {(["front", "back", "left", "right"] as AngleView[]).map((v) => (
                  <div key={v} className="space-y-1.5 text-center">
                    <div className="aspect-square rounded-xl border border-stone-200 overflow-hidden bg-stone-100 shadow-2xs">
                      {slots[v].previewUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={slots[v].previewUrl!}
                          alt={v}
                          className="h-full w-full object-cover"
                        />
                      )}
                    </div>
                    <span className="text-xs font-bold uppercase tracking-wider text-stone-600">
                      {v}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Specs Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 rounded-xl border border-stone-200/80 bg-stone-50/70 text-xs">
              <div>
                <span className="text-stone-400 block text-xs">Product</span>
                <span className="font-bold text-stone-800">{name}</span>
              </div>
              <div>
                <span className="text-stone-400 block text-xs">Pipeline Mode</span>
                <span className="font-bold text-amber-800">
                  {generationMode === "image_to_3d" ? "Image to 3D" : "Multi Image to 3D"}
                </span>
              </div>
              <div>
                <span className="text-stone-400 block text-xs">Category</span>
                <span className="font-bold text-stone-800">{category}</span>
              </div>
              <div>
                <span className="text-stone-400 block text-xs">Dimensions</span>
                <span className="font-bold text-stone-800">
                  {widthMm / 10} × {depthMm / 10} × {heightMm / 10} cm
                </span>
              </div>
              <div>
                <span className="text-stone-400 block text-xs">Texture Map</span>
                <span className="font-bold text-stone-800">2K Resolution</span>
              </div>
              <div>
                <span className="text-stone-400 block text-xs">Estimated Cost</span>
                <span className="font-bold text-amber-700">
                  {creditInfo
                    ? `${generationMode === "image_to_3d" ? creditInfo.single : creditInfo.multi} credits (${creditInfo.remaining} left)`
                    : "—"}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setShowReviewModal(false)}
                disabled={submitting}
                className="border-stone-200 text-stone-700 hover:bg-stone-50"
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirmAndGenerate}
                disabled={submitting}
                className="gap-2 min-w-44 bg-stone-900 hover:bg-stone-800 text-white font-bold shadow-xs"
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
      className={`relative overflow-hidden border-2 transition-all flex flex-col justify-between rounded-2xl studio-card-shadow ${
        slot.previewUrl
          ? "border-emerald-300 bg-emerald-50/20"
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

      <div className="p-3.5 border-b border-stone-100 flex items-center justify-between">
        <span className="text-xs font-bold text-stone-900">{slot.title}</span>
        {slot.previewUrl && (
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
        )}
      </div>

      <div className="p-4 flex-1 flex flex-col items-center justify-center min-h-44">
        {slot.previewUrl ? (
          <div className="relative w-full aspect-square rounded-xl overflow-hidden border border-stone-200 bg-stone-100 group shadow-2xs">
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
                className="h-7 text-xs font-medium"
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
            className="cursor-pointer text-center space-y-2.5 p-3 hover:scale-[1.02] transition-transform"
          >
            <div className="h-10 w-10 rounded-xl bg-stone-100 text-stone-600 mx-auto flex items-center justify-center">
              <Upload className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-stone-800">
                Click or drag image
              </p>
              <p className="text-xs text-stone-400 mt-0.5">
                PNG, JPG, WebP up to 10MB
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="p-3 bg-stone-50/80 border-t border-stone-100 text-xs text-stone-500 text-center font-medium">
        {slot.description}
      </div>
    </Card>
  );
}
