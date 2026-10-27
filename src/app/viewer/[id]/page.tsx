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
  Store,
  ExternalLink,
  XCircle,
  Share2,
  Check,
  Ruler,
} from "lucide-react";
import { buildProductWhatsAppUrl } from "@/lib/whatsapp";
import { isSimulatedAttempt, latestModelAttempt } from "@/lib/product-model";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ModelViewer } from "@/components/studio/model-viewer";
import { SceneEditor } from "@/components/studio/scene-editor/scene-editor";
import { SceneView } from "@/components/studio/scene/scene-view";
import { useFeature, useFeatures } from "@/lib/features/features-context";
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
  const { user, isSaasAdmin, isLoading: authLoading } = useAuth();
  const generationOn = useFeature("model_generation");
  const { loaded: featuresLoaded } = useFeatures();
  const sceneEditorOn = useFeature("scene_editor");
  const captureOn = useFeature("capture_thumbnails");
  const backdropOn = useFeature("backdrop_menu");
  const whatsappOn = useFeature("whatsapp_contact");
  const origin = useOrigin();

  const [product, setProduct] = useState<StoredProduct | null>(null);
  const [merchantWhatsapp, setMerchantWhatsapp] = useState<string | null>(null);
  const [merchantName, setMerchantName] = useState<string | null>(null);
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
  const [copiedLink, setCopiedLink] = useState(false);

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
    if (!merchantId) return;
    let ignore = false;
    fetch(`/api/merchants/${encodeURIComponent(merchantId)}/public`)
      .then((res) => res.json())
      .then((json) => {
        if (!ignore && json.success && json.data) {
          setMerchantWhatsapp(json.data.whatsappNumber || null);
          setMerchantName(json.data.businessName || json.data.name || null);
        }
      })
      .catch(() => {});
    return () => {
      ignore = true;
    };
  }, [merchantId]);

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

  // Copy 3D Model Link
  const handleCopyLink = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  // Standalone Loading State (NO SIDEBAR, NO PORTAL)
  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] text-stone-900 font-sans">
        <header className="border-b border-stone-200/60 bg-white">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
            <div className="flex items-center gap-2">
              <Skeleton className="h-8 w-24 rounded-lg" />
              <Skeleton className="h-6 w-36 rounded-md" />
            </div>
            <Skeleton className="h-8 w-28 rounded-lg" />
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <Skeleton className="h-96 w-full rounded-2xl sm:h-140" />
            </div>
            <div className="space-y-4">
              <Skeleton className="h-32 w-full rounded-2xl" />
              <Skeleton className="h-44 w-full rounded-2xl" />
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Standalone Error State (NO SIDEBAR, NO PORTAL)
  if (errorMsg || !product) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#F8FAFC] px-4 text-center text-stone-900 font-sans">
        <div className="w-full max-w-md space-y-4 rounded-3xl border border-stone-200/80 bg-white p-8 shadow-xs">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-stone-100 text-stone-400">
            <Box className="h-7 w-7" />
          </div>
          <h1 className="text-xl font-bold">{errorMsg || "Product Not Found"}</h1>
          <p className="text-xs text-stone-500">
            This 3D furniture model does not exist or has been removed.
          </p>
          <Link
            href={merchantId ? `/store/${merchantId}` : "/"}
            className="inline-block mt-2"
          >
            <Button className="bg-gradient-brand text-white font-semibold">
              Return to Shop
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const latestAttempt = product.generationAttempts[0];
  const modelAttempt = latestModelAttempt(product);
  const modelUrl = modelAttempt?.modelUrl;
  const isCancelled = latestAttempt?.errorCode === "CANCELLED_BY_USER";
  const sizeLabel = `${formatDimension(product.widthMm)} × ${formatDimension(product.depthMm)} × ${formatDimension(product.heightMm)}`;
  const singleImage = product.images.length === 1;

  const specs: { label: string; value: string }[] = [
    {
      label: "Price",
      value: product.priceBdt > 0 ? `৳${product.priceBdt.toLocaleString("en-BD")}` : "Price on request",
    },
    { label: "Dimensions", value: sizeLabel },
    { label: "3D Format", value: "GLB (glTF 2.0)" },
    { label: "Materials", value: "PBR Textures" },
    { label: "Accuracy", value: "1:1 Physical Scale" },
  ];

  const storeBackHref = product.merchantId ? `/store/${product.merchantId}` : "/";

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-stone-900 font-sans">
      {/* 1. STANDALONE 3D VIEWER HEADER (NO SIDEBAR, NO PORTAL) */}
      <header className="sticky top-0 z-30 border-b border-stone-200/70 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-2.5 sm:px-6 lg:px-8">
          {/* Left: Return to Shop */}
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href={storeBackHref}
              className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-stone-700 shadow-2xs hover:bg-stone-50 transition-colors shrink-0"
              title="Return to Shop Catalog"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Back to Shop</span>
              <span className="sm:hidden">Back</span>
            </Link>

            <div className="h-4 w-px bg-stone-200 shrink-0" />

            <div className="min-w-0">
              <h1 className="truncate text-sm sm:text-base font-bold text-stone-950">
                {product.name}
              </h1>
            </div>

            <Badge variant="outline" className="hidden sm:inline-flex text-[10px] font-bold text-indigo-700 border-indigo-200 bg-indigo-50/50">
              {product.category}
            </Badge>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2">
            {/* Share 3D Link */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyLink}
              aria-label="Share 3D Model"
              className="h-8.5 rounded-xl border-stone-200 bg-white px-2.5 text-xs font-semibold text-stone-700 shadow-2xs hover:bg-stone-50 gap-1.5"
            >
              {copiedLink ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                  <span className="text-emerald-700">Copied</span>
                </>
              ) : (
                <>
                  <Share2 className="h-3.5 w-3.5 text-stone-500" />
                  <span className="hidden sm:inline">Share 3D</span>
                </>
              )}
            </Button>

            {/* Direct WhatsApp Order */}
            {whatsappUrl && (
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-8.5 items-center gap-1.5 rounded-xl bg-[#25D366] px-3 text-xs font-bold text-white shadow-2xs hover:bg-[#20bd5a] transition-colors"
              >
                <MessageCircle className="h-3.5 w-3.5 fill-white text-white" />
                <span>Order via WhatsApp</span>
              </a>
            )}

            {/* Internal Dashboard Link ONLY for merchant owner or admin */}
            {canManage && (
              <Link
                href="/products"
                className="hidden md:inline-flex items-center text-xs font-semibold text-stone-500 hover:text-stone-900 ml-2"
              >
                Dashboard
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* 2. MAIN 3D CANVAS & DETAILS (NO PORTAL SIDEBAR) */}
      <main className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8 space-y-6">
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3 lg:gap-8">
          {/* Left: 3D Model Viewer Canvas */}
          <div className="lg:col-span-2">
            {product.status === "completed" && modelUrl && (authLoading || !sceneLoaded || !featuresLoaded) ? (
              <Skeleton className="h-96 w-full rounded-2xl sm:h-140" />
            ) : product.status === "completed" && modelUrl ? (
              <div className="w-full space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">
                    <Sparkles className="h-3.5 w-3.5 text-amber-600" />
                    Interactive 3D Model
                  </span>
                  {modelAttempt && isSimulatedAttempt(modelAttempt) && (
                    <span className="rounded-full bg-stone-200 px-2.5 py-1 text-xs font-semibold text-stone-700">
                      Simulated sample — not built from your photos
                    </span>
                  )}
                </div>

                {canEditScene && sceneError && (
                  <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
                    Scene editing is off because the saved scene could not be loaded ({sceneError}). Reload the page to try again.
                  </p>
                )}

                <div className="h-96 sm:h-140 overflow-hidden rounded-2xl border border-stone-200/80 bg-white shadow-2xs">
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
                    showCapture={captureOn && canManage}
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
              <div className="glass-panel studio-card-shadow flex h-96 flex-col items-center justify-center rounded-2xl p-6 text-center sm:h-140 sm:p-8">
                <div className="w-full max-w-md space-y-5">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
                    <Sparkles className="h-7 w-7 animate-spin" />
                  </div>
                  <div className="space-y-1.5">
                    <Badge variant="processing" className="text-xs font-semibold">
                      {product.generationMode === "image_to_3d" || singleImage
                        ? "Image to 3D"
                        : "Multi-image 3D"}
                    </Badge>
                    <h2 className="text-lg font-semibold text-stone-900">Generating 3D model...</h2>
                  </div>
                  <div className="space-y-2" role="status" aria-live="polite">
                    <div
                      className="h-2 w-full overflow-hidden rounded-full bg-stone-100"
                      role="progressbar"
                      aria-label="Generation progress"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={pollingProgress}
                    >
                      <div
                        className="bg-gradient-brand h-2 rounded-full transition-all duration-500"
                        style={{ width: `${Math.max(15, pollingProgress)}%` }}
                      />
                    </div>
                    <p className="text-xs text-stone-500">{pollingProgress}%</p>
                  </div>
                  {canManage && (
                    <div className="flex flex-col items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCancelGeneration}
                        disabled={cancelling}
                        className="gap-1.5 border-rose-200 text-rose-700 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-800"
                      >
                        <XCircle className={`h-4 w-4 ${cancelling ? "animate-spin" : ""}`} />
                        <span>{cancelling ? "Cancelling..." : "Cancel Generation"}</span>
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ) : product.status === "failed" ? (
              <div className="glass-panel studio-card-shadow flex h-96 flex-col items-center justify-center rounded-2xl p-6 text-center sm:h-140 sm:p-8">
                <div className="w-full max-w-md space-y-5">
                  <div
                    className={`mx-auto flex h-14 w-14 items-center justify-center rounded-2xl ${
                      isCancelled ? "bg-stone-100 text-stone-600" : "bg-rose-50 text-rose-600"
                    }`}
                  >
                    {isCancelled ? <XCircle className="h-7 w-7" /> : <AlertTriangle className="h-7 w-7" />}
                  </div>
                  <div className="space-y-1.5" role="alert">
                    <Badge variant={isCancelled ? "secondary" : "destructive"}>
                      {isCancelled ? "Generation Cancelled" : "Generation Failed"}
                    </Badge>
                    <h2 className="text-lg font-semibold text-stone-900">
                      {isCancelled ? "Generation cancelled" : "Generation failed"}
                    </h2>
                    <p className="text-sm text-stone-500">
                      {latestAttempt?.errorMessage ||
                        (isCancelled ? "Stopped. You can restart anytime." : "Could not build a 3D mesh from these images.")}
                    </p>
                  </div>
                  <div className="flex flex-col items-center justify-center gap-2 sm:flex-row">
                    {canManage && generationOn && (
                      <Button onClick={handleRetry} disabled={retrying} className="w-full gap-2 sm:w-auto">
                        <RotateCcw className={`h-4 w-4 ${retrying ? "animate-spin" : ""}`} />
                        <span>{isCancelled ? "Restart Generation" : "Retry Generation"}</span>
                      </Button>
                    )}
                    <Link href={storeBackHref} className="w-full sm:w-auto">
                      <Button variant="ghost" className="w-full gap-1.5 sm:w-auto">
                        <ArrowLeft className="h-4 w-4" />
                        <span>Return to Shop</span>
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            ) : (
              <div className="glass-panel studio-card-shadow flex h-96 flex-col items-center justify-center rounded-2xl p-6 text-center sm:h-140 sm:p-8">
                <div className="w-full max-w-md space-y-4">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-stone-100 text-stone-600">
                    <Box className="h-7 w-7" />
                  </div>
                  <h2 className="text-lg font-semibold text-stone-900">Ready to generate</h2>
                  {canManage && generationOn && (
                    <Button onClick={handleRetry} disabled={retrying} className="w-full gap-2 sm:w-auto">
                      <Sparkles className="h-4 w-4" />
                      <span>Start 3D Generation</span>
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right: Product Details & WhatsApp Ordering Panel */}
          <aside className="space-y-5" aria-label="Product details and ordering">
            {/* Price & Order Card */}
            <div className="rounded-2xl border border-stone-200/80 bg-white p-5 shadow-2xs space-y-4">
              <div>
                <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
                  Furniture Piece
                </span>
                <h2 className="text-xl font-black text-stone-950 mt-0.5">
                  {product.name}
                </h2>
                <div className="mt-2 text-2xl font-black text-stone-950">
                  {product.priceBdt > 0 ? `৳${product.priceBdt.toLocaleString("en-BD")}` : "Price on request"}
                </div>
              </div>

              {whatsappUrl ? (
                <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="block w-full">
                  <Button className="w-full h-11 gap-2 bg-[#25D366] text-white hover:bg-[#20bd5a] font-bold text-sm rounded-xl shadow-xs">
                    <MessageCircle className="h-4 w-4 fill-white" />
                    <span>Order via WhatsApp</span>
                  </Button>
                </a>
              ) : null}

              <div className="flex items-center gap-2 pt-2 border-t border-stone-100 text-xs text-stone-600">
                <Ruler className="h-4 w-4 text-indigo-600 shrink-0" />
                <span>Physical Size: <strong className="text-stone-900">{sizeLabel}</strong></span>
              </div>
            </div>

            {/* Merchant / Storefront Card */}
            <div className="rounded-2xl border border-stone-200/80 bg-white p-5 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-stone-500 uppercase tracking-wider">
                  Crafted by
                </h3>
                <Link
                  href={storeBackHref}
                  className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:underline"
                >
                  <span>View Shop</span>
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-brand text-white font-bold text-sm shadow-xs shrink-0">
                  <Store className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-sm font-bold text-stone-950 truncate">
                    {merchantName || "Master Furniture Shop"}
                  </h4>
                  <p className="text-xs text-stone-500">Official 3D Showroom</p>
                </div>
              </div>
            </div>

            {/* Specifications Card */}
            <div className="rounded-2xl border border-stone-200/80 bg-white p-5 shadow-2xs space-y-3">
              <h3 className="text-xs font-bold text-stone-500 uppercase tracking-wider">
                Specifications
              </h3>
              <dl className="divide-y divide-stone-100 text-xs">
                {specs.map((spec) => (
                  <div key={spec.label} className="flex items-baseline justify-between py-2">
                    <dt className="text-stone-500">{spec.label}</dt>
                    <dd className="font-semibold text-stone-900">{spec.value}</dd>
                  </div>
                ))}
              </dl>
            </div>

            {/* Source Perspective Photos */}
            {product.images.length > 0 && (
              <div className="rounded-2xl border border-stone-200/80 bg-white p-5 shadow-2xs space-y-3">
                <h3 className="text-xs font-bold text-stone-500 uppercase tracking-wider">
                  Reference Photos ({product.images.length})
                </h3>
                <ul className="grid grid-cols-4 gap-2">
                  {product.images.map((img) => (
                    <li key={img.id} className="space-y-1">
                      <div className="aspect-square overflow-hidden rounded-lg bg-stone-100 border border-stone-200/60">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={img.publicUrl} alt={`${img.viewType} view`} className="h-full w-full object-cover" />
                      </div>
                      <span className="block text-[10px] capitalize text-stone-500 text-center">{img.viewType}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Management Actions ONLY for Merchant Owner */}
            {canManage && (
              <div className="rounded-2xl border border-stone-200/80 bg-stone-50 p-4 space-y-2">
                <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider block">
                  Merchant Controls
                </span>
                {product.status === "completed" && modelUrl && (
                  <Button onClick={handleDownloadGLB} disabled={downloading} variant="outline" className="w-full gap-2 text-xs h-9 bg-white">
                    <Download className="h-3.5 w-3.5" />
                    <span>{downloading ? "Preparing GLB..." : "Download GLB Asset"}</span>
                  </Button>
                )}
                {generationOn && (
                  <Button onClick={handleRetry} disabled={retrying} variant="ghost" className="w-full gap-2 text-xs h-9">
                    <RotateCcw className={`h-3.5 w-3.5 ${retrying ? "animate-spin" : ""}`} />
                    <span>Generate Again</span>
                  </Button>
                )}
              </div>
            )}
          </aside>
        </div>
      </main>
    </div>
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
        <div className="min-h-screen bg-[#F8FAFC] text-stone-900 font-sans p-6">
          <Skeleton className="h-10 w-48 rounded-xl mb-6" />
          <Skeleton className="h-140 w-full rounded-2xl" />
        </div>
      }
    >
      <ViewerContent id={resolvedParams.id} />
    </Suspense>
  );
}
