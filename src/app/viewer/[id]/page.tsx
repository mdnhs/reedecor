"use client";

import React, { useEffect, useState, use, Suspense } from "react";
import Link from "next/link";
import {
  Download,
  RotateCcw,
  Sparkles,
  ArrowLeft,
  AlertTriangle,
  Box,
  MessageCircle,
  Heart,
  Store,
  ExternalLink,
} from "lucide-react";
import { buildProductWhatsAppUrl } from "@/lib/whatsapp";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ModelViewer } from "@/components/studio/model-viewer";
import { StoredProduct } from "@/server/demo-store";
import { formatDimension } from "@/lib/utils";
import { saveGeneratedModelToIDB, getGeneratedModelFromIDB } from "@/lib/storage/indexeddb-storage";
import { useAuth } from "@/lib/auth/auth-context";

function ViewerContent({ id }: { id: string }) {
  const { user, isCustomer } = useAuth();
  const [product, setProduct] = useState<StoredProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [pollingProgress, setPollingProgress] = useState<number>(30);
  const [downloading, setDownloading] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isWishlisted, setIsWishlisted] = useState(false);

  useEffect(() => {
    let ignore = false;
    async function loadWishlist() {
      if (!user) return;
      try {
        const res = await fetch("/api/wishlists");
        const json = await res.json();
        if (!ignore && json.success && Array.isArray(json.data)) {
          setIsWishlisted(json.data.includes(id));
        }
      } catch (e) {
        console.error("Error loading wishlist:", e);
      }
    }
    loadWishlist();
    return () => {
      ignore = true;
    };
  }, [user, id]);

  async function handleToggleWishlist() {
    if (!user) {
      alert("Please select a persona or sign in to add to your wishlist.");
      return;
    }
    try {
      const res = await fetch(`/api/wishlists/${id}/toggle`, { method: "POST" });
      const json = await res.json();
      if (json.success) {
        setIsWishlisted(json.data.inWishlist);
      }
    } catch (e) {
      console.error("Error toggling wishlist:", e);
    }
  }

  // Initial Load
  useEffect(() => {
    async function loadProduct() {
      try {
        const res = await fetch(`/api/products/${id}`);
        const json = await res.json();
        if (json.success) {
          setProduct(json.data);
        } else {
          setErrorMsg(json.error || "Product not found");
        }
      } catch {
        setErrorMsg("Failed to connect to studio server");
      } finally {
        setLoading(false);
      }
    }
    loadProduct();
  }, [id]);

  // Polling if processing
  const isProcessing = product?.status === "processing";
  useEffect(() => {
    if (!isProcessing) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/products/${id}/status`);
        const json = await res.json();
        if (json.success) {
          setPollingProgress(json.data.progress || 50);

          if (json.data.status === "completed" || json.data.status === "failed") {
            const prodRes = await fetch(`/api/products/${id}`);
            const prodJson = await prodRes.json();
            if (prodJson.success) {
              setProduct(prodJson.data);
            }
          }
        }
      } catch (err) {
        console.error("Status check failed:", err);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [id, isProcessing]);

  // Download GLB Action
  const handleDownloadGLB = async () => {
    const latestAttempt = product?.generationAttempts?.[0];
    const modelUrl = latestAttempt?.modelUrl;
    if (!modelUrl || !product) return;

    setDownloading(true);
    try {
      const cached = await getGeneratedModelFromIDB(product.id);
      let blob: Blob;

      if (cached) {
        blob = cached.blob;
      } else {
        const res = await fetch(modelUrl);
        blob = await res.blob();
        await saveGeneratedModelToIDB(product.id, blob, `${product.name}.glb`);
      }

      const tempUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = tempUrl;
      const safeFilename = `${product.name.toLowerCase().replace(/[^a-z0-9]/g, "-")}-3d.glb`;
      a.download = safeFilename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      setTimeout(() => URL.revokeObjectURL(tempUrl), 1000);
    } catch (err) {
      console.error("Download failed:", err);
      alert("Failed to download GLB model file.");
    } finally {
      setDownloading(false);
    }
  };

  // Retry Generation Action
  const handleRetry = async () => {
    if (retrying || !product) return;
    setRetrying(true);
    try {
      const res = await fetch(`/api/products/${id}/retry`, { method: "POST" });
      const json = await res.json();
      if (json.success) {
        const prodRes = await fetch(`/api/products/${id}`);
        const prodJson = await prodRes.json();
        if (prodJson.success) {
          setProduct(prodJson.data);
        }
      } else {
        alert(json.error || "Retry failed");
      }
    } catch (err) {
      console.error("Retry request failed:", err);
    } finally {
      setRetrying(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout title="3D Studio Viewer">
        <div className="space-y-6">
          <Skeleton className="h-8 w-48" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Skeleton className="lg:col-span-2 h-[550px] rounded-xl" />
            <Skeleton className="h-[550px] rounded-xl" />
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (errorMsg || !product) {
    return (
      <DashboardLayout title="Product Not Found">
        <div className="text-center py-16 space-y-4">
          <p className="text-sm text-rose-600 font-semibold">{errorMsg || "Product does not exist"}</p>
          <Link href="/products">
            <Button variant="outline" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              <span>Back to My Products</span>
            </Button>
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  const latestAttempt = product.generationAttempts[0];
  const modelUrl = latestAttempt?.modelUrl;

  return (
    <DashboardLayout
      title={`${product.name} — 3D Studio`}
      subtitle={`Category: ${product.category} • ${product.images.length}/4 Perspective Views`}
    >
      <div className="space-y-6">
        {/* Top Action Bar */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between pb-4 border-b border-stone-200/80">
          <div className="flex items-center gap-3">
            <Link href="/products">
              <Button size="icon" variant="ghost" className="h-8 w-8 text-stone-500">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-base sm:text-lg font-bold text-stone-900 tracking-tight">
                {product.name}
              </h1>
              <p className="text-xs text-stone-500">
                Dimensions: {formatDimension(product.widthMm)} × {formatDimension(product.depthMm)} × {formatDimension(product.heightMm)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {product.status === "completed" && modelUrl && (
              <Button
                onClick={handleDownloadGLB}
                disabled={downloading}
                size="sm"
                className="gap-2 bg-stone-900 text-stone-50 hover:bg-stone-800"
              >
                <Download className="h-4 w-4" />
                <span>{downloading ? "Preparing GLB..." : "Download GLB"}</span>
              </Button>
            )}

            {!isCustomer && (
              <Button
                onClick={handleRetry}
                disabled={retrying || product.status === "processing"}
                size="sm"
                variant="outline"
                className="gap-2"
              >
                <RotateCcw className={`h-4 w-4 ${retrying ? "animate-spin" : ""}`} />
                <span>{retrying ? "Initiating..." : "Generate Again"}</span>
              </Button>
            )}
          </div>
        </div>

        {/* Studio Main Workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          <div className="lg:col-span-2 space-y-4">
            {product.status === "completed" && modelUrl ? (
              <div className="h-[550px] w-full">
                <ModelViewer
                  modelUrl={modelUrl}
                  widthMm={product.widthMm}
                  depthMm={product.depthMm}
                  heightMm={product.heightMm}
                />
              </div>
            ) : product.status === "processing" ? (
              <Card className="h-[550px] flex flex-col items-center justify-center p-8 text-center bg-white border-dashed border-2 border-amber-300">
                <div className="max-w-md space-y-5">
                  <div className="h-16 w-16 rounded-2xl bg-amber-50 text-amber-600 mx-auto flex items-center justify-center">
                    <Sparkles className="h-8 w-8 animate-spin" />
                  </div>
                  <div>
                    <Badge variant="processing" className="text-xs font-semibold">
                      Meshy AI Multi-Image Pipeline
                    </Badge>
                    <h3 className="text-lg font-bold text-stone-900 mt-2">
                      Generating Textured 3D Model...
                    </h3>
                    <p className="text-xs text-stone-500 mt-1">
                      Synthesizing 4 angle photographs into a 3D polygonal mesh with PBR textures and normal maps.
                    </p>
                  </div>

                  <div className="w-full bg-stone-100 rounded-full h-2.5 overflow-hidden">
                    <div
                      className="bg-amber-600 h-2.5 rounded-full transition-all duration-500"
                      style={{ width: `${Math.max(15, pollingProgress)}%` }}
                    />
                  </div>
                  <p className="text-[11px] font-mono text-stone-400">
                    Task Status: IN_PROGRESS (~{pollingProgress}% completed)
                  </p>
                </div>
              </Card>
            ) : product.status === "failed" ? (
              <Card className="h-[550px] flex flex-col items-center justify-center p-8 text-center bg-white border-dashed border-2 border-rose-300">
                <div className="max-w-md space-y-4">
                  <div className="h-14 w-14 rounded-2xl bg-rose-50 text-rose-600 mx-auto flex items-center justify-center">
                    <AlertTriangle className="h-7 w-7" />
                  </div>
                  <div>
                    <Badge variant="destructive">Generation Failed</Badge>
                    <h3 className="text-base font-bold text-stone-900 mt-2">
                      Meshy AI generation encountered an issue
                    </h3>
                    <p className="text-xs text-stone-500 mt-1">
                      {latestAttempt?.errorMessage ||
                        "Unable to reconstruct 3D mesh from the supplied images. Ensure lighting is consistent."}
                    </p>
                  </div>
                  <Button onClick={handleRetry} disabled={retrying} className="gap-2">
                    <RotateCcw className="h-4 w-4" />
                    <span>Retry Generation</span>
                  </Button>
                </div>
              </Card>
            ) : (
              <Card className="h-[550px] flex flex-col items-center justify-center p-8 text-center bg-white">
                <div className="max-w-md space-y-4">
                  <div className="h-14 w-14 rounded-2xl bg-stone-100 text-stone-600 mx-auto flex items-center justify-center">
                    <Box className="h-7 w-7" />
                  </div>
                  <h3 className="text-base font-bold text-stone-900">
                    Ready to Generate 3D Model
                  </h3>
                  <p className="text-xs text-stone-500">
                    All 4 angle views are uploaded. Initiate Meshy Multi-Image generation.
                  </p>
                  <Button onClick={handleRetry} disabled={retrying} className="gap-2">
                    <Sparkles className="h-4 w-4" />
                    <span>Start 3D Generation</span>
                  </Button>
                </div>
              </Card>
            )}
          </div>

          <div className="space-y-4">
            <Card className="border-stone-200/80 bg-white">
              <CardHeader className="pb-3">
                <CardTitle className="text-xs uppercase tracking-wider font-semibold text-stone-500">
                  Source Photographs
                </CardTitle>
                <CardDescription className="text-xs">
                  4 perspective angles used for 3D AI reconstruction
                </CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-2">
                {product.images.map((img) => (
                  <div key={img.id} className="space-y-1 text-center">
                    <div className="aspect-square rounded-lg border border-stone-200 overflow-hidden bg-stone-50">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={img.publicUrl}
                        alt={img.viewType}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <span className="text-[10px] font-semibold uppercase text-stone-600">
                      {img.viewType} view
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="border-stone-200/80 bg-white">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs uppercase tracking-wider font-semibold text-stone-500">
                  Model Specifications & Pricing
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-xs">
                <div className="flex justify-between py-1.5 border-b border-stone-100 items-baseline">
                  <span className="text-stone-500">Purchase Price:</span>
                  <span className="font-bold text-sm text-stone-900 font-mono">
                    ৳{(product.priceBdt || 18500).toLocaleString("en-BD")}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-stone-100">
                  <span className="text-stone-500">Format:</span>
                  <span className="font-semibold text-stone-900">GLB (Binary glTF 2.0)</span>
                </div>
                <div className="flex justify-between py-1 border-b border-stone-100">
                  <span className="text-stone-500">Physical Size:</span>
                  <span className="font-semibold text-stone-900">
                    {formatDimension(product.widthMm)} × {formatDimension(product.depthMm)} × {formatDimension(product.heightMm)}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-stone-100">
                  <span className="text-stone-500">PBR Materials:</span>
                  <span className="font-semibold text-emerald-700">Supported (2K Texture)</span>
                </div>
                <div className="flex justify-between py-1 border-b border-stone-100">
                  <span className="text-stone-500">Provider:</span>
                  <span className="font-semibold text-stone-900">Meshy AI Multi-Image</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-stone-500">Task Attempts:</span>
                  <span className="font-semibold text-stone-900">
                    {product.generationAttempts.length} attempt(s)
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Direct Merchant WhatsApp Ordering Card */}
            <Card className="border-emerald-200/80 bg-emerald-50/40 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageCircle className="w-4 h-4 text-[#25D366]" />
                  <h4 className="text-xs font-bold text-emerald-900">Order via WhatsApp</h4>
                </div>
                <span className="text-[10px] text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full font-medium">
                  Direct to Merchant
                </span>
              </div>
              <p className="text-[11px] text-stone-600 leading-relaxed">
                Connect directly with the merchant with pre-filled dimensions, purchase price, and 3D preview link.
              </p>
              <div className="flex items-center gap-2">
                <a
                  href={buildProductWhatsAppUrl("01865818044", {
                    id: product.id,
                    name: product.name,
                    category: product.category,
                    priceBdt: product.priceBdt || 18500,
                    widthMm: product.widthMm,
                    depthMm: product.depthMm,
                    heightMm: product.heightMm,
                    storeUrl: typeof window !== "undefined" ? window.location.href : undefined,
                  })}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1"
                >
                  <Button
                    size="sm"
                    className="w-full bg-[#25D366] hover:bg-[#20ba59] text-white text-xs h-9 gap-1.5 shadow-xs font-medium"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>Inquire on WhatsApp</span>
                  </Button>
                </a>
                <button
                  type="button"
                  onClick={handleToggleWishlist}
                  className={`h-9 px-3 rounded-md border flex items-center justify-center transition-colors ${
                    isWishlisted
                      ? "bg-rose-50 border-rose-200 text-rose-600"
                      : "bg-white border-stone-200 text-stone-600 hover:text-rose-600 hover:bg-stone-50"
                  }`}
                  title={isWishlisted ? "In Wishlist" : "Save to Wishlist"}
                >
                  <Heart className={`w-4 h-4 ${isWishlisted ? "fill-rose-500 text-rose-500" : ""}`} />
                </button>
              </div>
              <Link
                href={`/store/${product.merchantId || "demo-merchant-001"}`}
                target="_blank"
                className="inline-flex items-center gap-1.5 text-[11px] text-stone-600 hover:text-stone-900 font-medium transition-colors pt-1"
              >
                <Store className="w-3.5 h-3.5 text-amber-700" />
                <span>Visit Merchant Storefront</span>
                <ExternalLink className="w-2.5 h-2.5 ml-0.5 text-stone-400" />
              </Link>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

export default function ProductViewerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  return (
    <Suspense
      fallback={
        <DashboardLayout title="3D Studio Viewer">
          <div className="space-y-6">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-[550px] w-full rounded-xl" />
          </div>
        </DashboardLayout>
      }
    >
      <ViewerContent id={resolvedParams.id} />
    </Suspense>
  );
}
