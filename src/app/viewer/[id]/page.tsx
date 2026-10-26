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
  XCircle,
} from "lucide-react";
import { buildProductWhatsAppUrl } from "@/lib/whatsapp";
import { isSimulatedAttempt, latestModelAttempt } from "@/lib/product-model";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ModelViewer } from "@/components/studio/model-viewer";
import { SceneEditor } from "@/components/studio/scene-editor/scene-editor";
import { SceneView } from "@/components/studio/scene/scene-view";
import { useFeature } from "@/lib/features/features-context";
import type { BackdropMode } from "@/components/studio/backdrop";
import { EMPTY_SCENE, type ResolvedScene } from "@/lib/scenes/types";
import { StoredProduct } from "@/server/demo-store";
import { formatDimension } from "@/lib/utils";
import { useAuth } from "@/lib/auth/auth-context";
import { useOrigin } from "@/lib/hooks/use-origin";
import {
  saveGeneratedModelToIDB,
  getGeneratedModelFromIDB,
} from "@/lib/storage/indexeddb-storage";

const EMPTY_SCENE_RESOLVED: ResolvedScene = { ...EMPTY_SCENE, items: [] };

function ViewerContent({ id }: { id: string }) {
  const { user, isCustomer, isSaasAdmin, isLoading: authLoading } = useAuth();
  const generationOn = useFeature("model_generation");
  const sceneEditorOn = useFeature("scene_editor");
  const captureOn = useFeature("capture_thumbnails");
  const backdropOn = useFeature("backdrop_menu");
  const wishlistOn = useFeature("wishlist");
  const whatsappOn = useFeature("whatsapp_contact");
  const origin = useOrigin();
  const [product, setProduct] = useState<StoredProduct | null>(null);
  const [merchantWhatsapp, setMerchantWhatsapp] = useState<string | null>(null);
  const [scene, setScene] = useState<ResolvedScene | null>(null);
  const [sceneLoaded, setSceneLoaded] = useState(false);
  const [sceneError, setSceneError] = useState<string | null>(null);
  const [sceneRendered, setSceneRendered] = useState(false);
  const [backdrop, setBackdrop] = useState<BackdropMode>("auto");
  const [loading, setLoading] = useState(true);
  const [pollingProgress, setPollingProgress] = useState<number>(30);
  const [downloading, setDownloading] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [cancelling, setCancelling] = useState(false);
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

  const merchantId = product?.merchantId;
  useEffect(() => {
    if (!merchantId || !whatsappOn) return;
    let ignore = false;
    fetch(`/api/merchants/${encodeURIComponent(merchantId)}/public`)
      .then((res) => res.json())
      .then((json) => {
        if (!ignore) setMerchantWhatsapp(json.success ? json.data.whatsappNumber : null);
      })
      .catch(() => {});
    return () => {
      ignore = true;
    };
  }, [merchantId, whatsappOn]);

  const whatsappUrl =
    whatsappOn && product && product.priceBdt > 0
      ? buildProductWhatsAppUrl(merchantWhatsapp, {
          id: product.id,
          name: product.name,
          category: product.category,
          priceBdt: product.priceBdt,
          widthMm: product.widthMm,
          depthMm: product.depthMm,
          heightMm: product.heightMm,
          storeUrl: origin ? `${origin}/viewer/${product.id}` : undefined,
        })
      : null;

  const canManage =
    !!product && !!user && (isSaasAdmin || (user.role === "merchant" && product.merchantId === user.id));
  const canEditScene = sceneEditorOn && canManage;

  const sceneEnabled = product?.status === "completed";

  useEffect(() => {
    if (!sceneEnabled) return;
    let ignore = false;
    async function loadScene() {
      try {
        const res = await fetch(`/api/products/${id}/scene`);
        const json = await res.json();
        if (ignore) return;
        if (!json.success) throw new Error(json.error || "Could not load the saved scene");
        setScene(json.data);
        setBackdrop(json.data.backdrop);
      } catch (e) {
        console.error("Error loading scene:", e);
        if (!ignore) setSceneError(e instanceof Error ? e.message : "Could not load the saved scene");
      } finally {
        if (!ignore) setSceneLoaded(true);
      }
    }
    loadScene();
    return () => {
      ignore = true;
    };
  }, [sceneEnabled, id]);

  // Polling if processing
  const isProcessing = product?.status === "processing";
  useEffect(() => {
    if (!isProcessing) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/products/${id}/status`);
        const json = await res.json();
        if (json.success && json.data) {
          if (typeof json.data.progress === "number" && json.data.progress > 0) {
            setPollingProgress(json.data.progress);
          }

          if (json.data.status === "completed" || json.data.status === "failed") {
            if (json.data.status === "completed") {
              setPollingProgress(100);
            }
            const prodRes = await fetch(`/api/products/${id}`);
            const prodJson = await prodRes.json();
            if (prodJson.success && prodJson.data) {
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

  const saveThumbnail = async (image: Blob) => {
    const res = await fetch(`/api/products/${id}/thumbnail`, {
      method: "POST",
      headers: { "Content-Type": image.type || "image/png" },
      body: image,
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || "Could not save thumbnail");
    setProduct((p) => (p ? { ...p, thumbnailUrl: json.data.thumbnailUrl } : p));
  };

  // Download GLB Action
  const handleDownloadGLB = async () => {
    const modelAttempt = product ? latestModelAttempt(product) : null;
    const modelUrl = modelAttempt?.modelUrl;
    if (!modelUrl || !product || !modelAttempt) return;
    const cacheKey = `${product.id}:${modelAttempt.id}`;

    setDownloading(true);
    try {
      const cached = await getGeneratedModelFromIDB(cacheKey);
      let blob: Blob;

      if (cached) {
        blob = cached.blob;
      } else {
        const downloadUrl =
          modelUrl.startsWith("http://") || modelUrl.startsWith("https://")
            ? `/api/proxy-model?url=${encodeURIComponent(modelUrl)}`
            : modelUrl;
        const res = await fetch(downloadUrl);
        if (!res.ok) throw new Error(`Model download failed (${res.status})`);
        blob = await res.blob();
        await saveGeneratedModelToIDB(cacheKey, blob, `${product.name}.glb`);
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

  // Cancel Generation Action
  const handleCancelGeneration = async () => {
    if (cancelling || !product) return;
    const confirmed = window.confirm(
      "Are you sure you want to cancel this 3D model generation? You can restart it or edit your details anytime."
    );
    if (!confirmed) return;

    setCancelling(true);
    try {
      const res = await fetch(`/api/products/${id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resetToDraft: false }),
      });
      const json = await res.json();
      if (json.success) {
        if (json.data) {
          setProduct(json.data);
        } else {
          const prodRes = await fetch(`/api/products/${id}`);
          const prodJson = await prodRes.json();
          if (prodJson.success) setProduct(prodJson.data);
        }
      } else {
        alert(json.error || "Failed to cancel generation");
      }
    } catch (err) {
      console.error("Cancellation request failed:", err);
      alert("Network error while attempting to cancel generation.");
    } finally {
      setCancelling(false);
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
  const modelAttempt = latestModelAttempt(product);
  const modelUrl = modelAttempt?.modelUrl;
  const isCancelled = latestAttempt?.errorCode === "CANCELLED_BY_USER";

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

            {!isCustomer && product.status === "processing" && (
              <Button
                onClick={handleCancelGeneration}
                disabled={cancelling}
                size="sm"
                variant="outline"
                className="gap-1.5 border-rose-200 text-rose-700 hover:bg-rose-50 hover:border-rose-300 text-xs font-medium"
              >
                <XCircle className={`h-4 w-4 ${cancelling ? "animate-spin" : "text-rose-600"}`} />
                <span>{cancelling ? "Cancelling..." : "Cancel Generation"}</span>
              </Button>
            )}

            {!isCustomer && generationOn && product.status !== "processing" && (
              <Button
                onClick={handleRetry}
                disabled={retrying}
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
            {product.status === "completed" && modelUrl && (authLoading || !sceneLoaded) ? (
              <Skeleton className="h-[550px] w-full" />
            ) : product.status === "completed" && modelUrl ? (
              <div className="w-full space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">
                    <Sparkles className="h-3.5 w-3.5" />
                    AI-generated 3D model
                  </span>
                  {modelAttempt && isSimulatedAttempt(modelAttempt) && (
                    <span className="rounded-full bg-stone-200 px-2.5 py-1 text-xs font-semibold text-stone-700">
                      Simulated sample — not built from your photos
                    </span>
                  )}
                </div>
                {canEditScene && sceneError && (
                  <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
                    Scene editing is off because the saved scene could not be loaded ({sceneError}). Reload the page to try again.
                  </p>
                )}
                <div className="h-140">
                  <ModelViewer
                    key={canEditScene ? "edit" : "view"}
                    modelUrl={modelUrl}
                    widthMm={product.widthMm}
                    depthMm={product.depthMm}
                    heightMm={product.heightMm}
                    captureName={product.name}
                    onFirstFrame={
                      product.thumbnailUrl || !captureOn || !canManage
                        ? undefined
                        : (image) => void saveThumbnail(image).catch(() => {})
                    }
                    onUseAsThumbnail={!canManage || !captureOn ? undefined : saveThumbnail}
                    showCapture={captureOn}
                    showBackdropMenu={backdropOn}
                    initialBackdrop={scene?.backdrop}
                    onBackdropChange={setBackdrop}
                    captureReady={sceneRendered || (canEditScene && !!sceneError)}
                    onReady={
                      canEditScene
                        ? undefined
                        : (context) => {
                            if (!scene) {
                              setSceneRendered(true);
                              return;
                            }
                            const view = new SceneView(context);
                            void view.load(scene).finally(() => setSceneRendered(true));
                            return () => view.dispose();
                          }
                    }
                    renderOverlay={
                      canEditScene && !sceneError
                        ? (context) => (
                            <SceneEditor
                              productId={product.id}
                              context={context}
                              backdrop={backdrop}
                              initialScene={scene ?? EMPTY_SCENE_RESOLVED}
                              onSaved={setScene}
                              onLoaded={() => setSceneRendered(true)}
                            />
                          )
                        : undefined
                    }
                  />
                </div>
              </div>
            ) : product.status === "processing" ? (
              <Card className="h-[550px] flex flex-col items-center justify-center p-8 text-center bg-white border-dashed border-2 border-amber-300">
                <div className="max-w-md space-y-5">
                  <div className="h-16 w-16 rounded-2xl bg-amber-50 text-amber-600 mx-auto flex items-center justify-center">
                    <Sparkles className="h-8 w-8 animate-spin" />
                  </div>
                  <div>
                    <Badge variant="processing" className="text-xs font-semibold">
                      {product.generationMode === "image_to_3d" || product.images.length === 1
                        ? "Meshy AI Image to 3D Pipeline"
                        : "Meshy AI Multi-Image Pipeline"}
                    </Badge>
                    <h3 className="text-lg font-bold text-stone-900 mt-2">
                      Generating Textured 3D Model...
                    </h3>
                    <p className="text-xs text-stone-500 mt-1">
                      {product.generationMode === "image_to_3d" || product.images.length === 1
                        ? "Synthesizing photograph into a 3D polygonal mesh with PBR textures and normal maps."
                        : "Synthesizing 4 angle photographs into a 3D polygonal mesh with PBR textures and normal maps."}
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

                  {/* Cancel Generation Option */}
                  {!isCustomer && (
                    <div className="pt-3 border-t border-amber-100 flex flex-col items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCancelGeneration}
                        disabled={cancelling}
                        className="border-rose-200 text-rose-700 hover:bg-rose-50 hover:border-rose-300 hover:text-rose-800 text-xs font-medium h-9 px-4 gap-1.5 shadow-2xs transition-colors"
                      >
                        <XCircle className={`h-4 w-4 ${cancelling ? "animate-spin" : "text-rose-600"}`} />
                        <span>{cancelling ? "Cancelling..." : "Cancel Generation"}</span>
                      </Button>
                      <p className="text-[11px] text-stone-400">
                        Stuck or submitted by mistake? Click to cancel and restart anytime.
                      </p>
                    </div>
                  )}
                </div>
              </Card>
            ) : product.status === "failed" ? (
              <Card className={`h-[550px] flex flex-col items-center justify-center p-8 text-center bg-white border-dashed border-2 ${
                isCancelled ? "border-stone-300" : "border-rose-300"
              }`}>
                <div className="max-w-md space-y-4">
                  <div className={`h-14 w-14 rounded-2xl mx-auto flex items-center justify-center ${
                    isCancelled ? "bg-stone-100 text-stone-600" : "bg-rose-50 text-rose-600"
                  }`}>
                    {isCancelled ? (
                      <XCircle className="h-7 w-7 text-stone-600" />
                    ) : (
                      <AlertTriangle className="h-7 w-7" />
                    )}
                  </div>
                  <div>
                    <Badge variant={isCancelled ? "secondary" : "destructive"}>
                      {isCancelled ? "Generation Cancelled" : "Generation Failed"}
                    </Badge>
                    <h3 className="text-base font-bold text-stone-900 mt-2">
                      {isCancelled
                        ? "3D Generation was Cancelled"
                        : "Meshy AI generation encountered an issue"}
                    </h3>
                    <p className="text-xs text-stone-500 mt-1">
                      {latestAttempt?.errorMessage ||
                        (isCancelled
                          ? "Generation was stopped. You can restart anytime or return to your products catalog."
                          : "Unable to reconstruct 3D mesh from the supplied images. Ensure lighting is consistent.")}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                    {generationOn && (
                      <Button onClick={handleRetry} disabled={retrying} className="gap-2 text-xs">
                        <RotateCcw className="h-4 w-4" />
                        <span>{isCancelled ? "Restart Generation" : "Retry Generation"}</span>
                      </Button>
                    )}
                    <Link href="/products">
                      <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                        <ArrowLeft className="h-3.5 w-3.5" />
                        <span>Back to Products</span>
                      </Button>
                    </Link>
                  </div>
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
                    All angle views are uploaded. Initiate Meshy AI 3D generation.
                  </p>
                  {generationOn && (
                    <Button onClick={handleRetry} disabled={retrying} className="gap-2">
                      <Sparkles className="h-4 w-4" />
                      <span>Start 3D Generation</span>
                    </Button>
                  )}
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
                  {product.images.length === 1
                    ? "1 perspective view uploaded (Single-Image AI Synthesis)"
                    : `${product.images.length} perspective angles used for 3D AI reconstruction`}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
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
                </div>

                {product.images.length === 1 && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-2.5 text-xs text-amber-900 space-y-1">
                    <div className="flex items-center gap-1.5 font-semibold text-amber-950 text-[11px]">
                      <Sparkles className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                      <span>Single-Photo Quality Notice</span>
                    </div>
                    <p className="text-[11px] leading-relaxed text-amber-800">
                      ১টি ছবি থেকে তৈরি হওয়ায় AI পেছনের অংশ অনুমান করে এবং সূক্ষ্ম টেক্সচার (যেমন ক্রোকোডাইল লেদার বা খোদাই) স্মুথ করে ফেলে। আসল চামড়ার টেক্সচার ও সঠিক কার্ভ পেতে ৪টি অ্যাঙ্গেল (Front, Back, Left, Right) আই-লেভেলে ছবি তুলে জেনারেট করুন।
                    </p>
                  </div>
                )}
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
                    {product.priceBdt > 0 ? `৳${product.priceBdt.toLocaleString("en-BD")}` : "Price on request"}
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
                  <span className="font-semibold text-stone-900">
                    {product.images.length === 1 ? "Meshy AI (Single Image)" : "Meshy AI (Multi-Image 4-View)"}
                  </span>
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
              {whatsappUrl && (
                <>
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
                </>
              )}
              <div className="flex items-center gap-2">
                {whatsappUrl && (
                  <a
                    href={whatsappUrl}
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
                )}
                {wishlistOn && (
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
                )}
              </div>
              <Link
                href={`/store/${product.merchantId}`}
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
