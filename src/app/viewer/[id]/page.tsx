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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ViewerSkeleton } from "@/components/ui/skeleton-patterns";
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
  const { user, isCustomer, isSaasAdmin, isLoading: authLoading } = useAuth();
  const generationOn = useFeature("model_generation");
  const { loaded: featuresLoaded } = useFeatures();
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
        <ViewerSkeleton />
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

  const sizeLabel = `${formatDimension(product.widthMm)} × ${formatDimension(product.depthMm)} × ${formatDimension(product.heightMm)}`;
  const singleImage = product.images.length === 1;
  const specs: { label: string; value: string }[] = [
    {
      label: "Price",
      value: product.priceBdt > 0 ? `৳${product.priceBdt.toLocaleString("en-BD")}` : "Price on request",
    },
    { label: "Size", value: sizeLabel },
    { label: "Format", value: "GLB" },
    { label: "Materials", value: "PBR 2K" },
    { label: "Provider", value: singleImage ? "Single image" : "4 views" },
    { label: "Attempts", value: String(product.generationAttempts.length) },
  ];

  return (
    <DashboardLayout
      title={`${product.name} — 3D Studio`}
      subtitle={`Category: ${product.category} • ${product.images.length}/4 Perspective Views`}
    >
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/products" aria-label="Back to My Products">
            <Button size="icon" variant="ghost" className="h-9 w-9 text-stone-500">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold tracking-tight text-stone-900">{product.name}</h1>
            <p className="text-xs text-stone-500">{sizeLabel}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3 lg:gap-8">
          <div className="lg:col-span-2">
            {product.status === "completed" && modelUrl && (authLoading || !sceneLoaded || !featuresLoaded) ? (
              <Skeleton className="h-96 w-full sm:h-140" />
            ) : product.status === "completed" && modelUrl ? (
              <div className="w-full space-y-3">
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
                  <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
                    Scene editing is off because the saved scene could not be loaded ({sceneError}). Reload the page to try again.
                  </p>
                )}
                <div className="h-96 sm:h-140">
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
                  {!isCustomer && (
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
                    {generationOn && (
                      <Button onClick={handleRetry} disabled={retrying} className="w-full gap-2 sm:w-auto">
                        <RotateCcw className={`h-4 w-4 ${retrying ? "animate-spin" : ""}`} />
                        <span>{isCancelled ? "Restart Generation" : "Retry Generation"}</span>
                      </Button>
                    )}
                    <Link href="/products" className="w-full sm:w-auto">
                      <Button variant="ghost" className="w-full gap-1.5 sm:w-auto">
                        <ArrowLeft className="h-4 w-4" />
                        <span>Back to Products</span>
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
                  {generationOn && (
                    <Button onClick={handleRetry} disabled={retrying} className="w-full gap-2 sm:w-auto">
                      <Sparkles className="h-4 w-4" />
                      <span>Start 3D Generation</span>
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>

          <aside className="space-y-8" aria-label="Product details and actions">
            {((product.status === "completed" && modelUrl) ||
              (!isCustomer && product.status === "processing") ||
              (!isCustomer && generationOn && product.status !== "processing")) && (
              <div className="flex flex-col gap-2">
                {product.status === "completed" && modelUrl && (
                  <Button onClick={handleDownloadGLB} disabled={downloading} className="w-full gap-2">
                    <Download className="h-4 w-4" />
                    <span>{downloading ? "Preparing GLB..." : "Download GLB"}</span>
                  </Button>
                )}
                {!isCustomer && product.status === "processing" && (
                  <Button
                    onClick={handleCancelGeneration}
                    disabled={cancelling}
                    variant="outline"
                    className="w-full gap-2 border-rose-200 text-rose-700 hover:border-rose-300 hover:bg-rose-50"
                  >
                    <XCircle className={`h-4 w-4 ${cancelling ? "animate-spin" : ""}`} />
                    <span>{cancelling ? "Cancelling..." : "Cancel Generation"}</span>
                  </Button>
                )}
                {!isCustomer && generationOn && product.status !== "processing" && (
                  <Button
                    onClick={handleRetry}
                    disabled={retrying}
                    variant={product.status === "completed" ? "ghost" : "outline"}
                    className="w-full gap-2"
                  >
                    <RotateCcw className={`h-4 w-4 ${retrying ? "animate-spin" : ""}`} />
                    <span>{retrying ? "Initiating..." : "Generate Again"}</span>
                  </Button>
                )}
              </div>
            )}

            <section aria-labelledby="viewer-details-heading" className="space-y-3">
              <h2 id="viewer-details-heading" className="text-sm font-semibold text-stone-900">
                Details
              </h2>
              <dl className="divide-y divide-stone-200/70 text-sm">
                {specs.map((spec) => (
                  <div key={spec.label} className="flex items-baseline justify-between gap-4 py-2">
                    <dt className="text-stone-500">{spec.label}</dt>
                    <dd className="text-right font-medium text-stone-900">{spec.value}</dd>
                  </div>
                ))}
              </dl>
            </section>

            <section aria-labelledby="viewer-photos-heading" className="space-y-3">
              <h2 id="viewer-photos-heading" className="text-sm font-semibold text-stone-900">
                Source photos
              </h2>
              <ul className="grid grid-cols-4 gap-2 lg:grid-cols-2">
                {product.images.map((img) => (
                  <li key={img.id} className="space-y-1">
                    <div className="aspect-square overflow-hidden rounded-lg bg-stone-100">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img.publicUrl} alt={`${img.viewType} view`} className="h-full w-full object-cover" />
                    </div>
                    <span className="block text-xs capitalize text-stone-500">{img.viewType}</span>
                  </li>
                ))}
              </ul>
              {singleImage && (
                <p className="flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">
                  <Sparkles className="h-3.5 w-3.5 shrink-0 text-amber-600" />
                  Single photo: add 4 angles for better quality
                </p>
              )}
            </section>

            <section aria-labelledby="viewer-contact-heading" className="space-y-3">
              <h2 id="viewer-contact-heading" className="text-sm font-semibold text-stone-900">
                {whatsappUrl ? "Order" : "Merchant"}
              </h2>
              {(whatsappUrl || wishlistOn) && (
                <div className="flex items-center gap-2">
                  {whatsappUrl && (
                    <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="flex-1">
                      <Button className="w-full gap-2 bg-emerald-600 text-white hover:bg-emerald-700">
                        <MessageCircle className="h-4 w-4" />
                        <span>WhatsApp</span>
                      </Button>
                    </a>
                  )}
                  {wishlistOn && (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={handleToggleWishlist}
                      aria-pressed={isWishlisted}
                      aria-label={isWishlisted ? "Remove from wishlist" : "Save to wishlist"}
                      title={isWishlisted ? "In Wishlist" : "Save to Wishlist"}
                      className={isWishlisted ? "border-rose-200 bg-rose-50 text-rose-600" : "text-stone-600 hover:text-rose-600"}
                    >
                      <Heart className={`h-4 w-4 ${isWishlisted ? "fill-rose-500 text-rose-500" : ""}`} />
                    </Button>
                  )}
                </div>
              )}
              <Link
                href={`/store/${product.merchantId}`}
                target="_blank"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-600 transition-colors hover:text-stone-900"
              >
                <Store className="h-4 w-4 text-amber-700" />
                <span>Storefront</span>
                <ExternalLink className="h-3 w-3 text-stone-400" />
              </Link>
            </section>
          </aside>
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
            <Skeleton className="h-140 w-full rounded-xl" />
          </div>
        </DashboardLayout>
      }
    >
      <ViewerContent id={resolvedParams.id} />
    </Suspense>
  );
}
