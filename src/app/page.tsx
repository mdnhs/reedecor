"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Box,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Plus,
  ArrowRight,
  Eye,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { StoredProduct } from "@/server/demo-store";
import { formatDimension } from "@/lib/utils";

export default function OverviewPage() {
  const [products, setProducts] = useState<StoredProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch("/api/products");
        const json = await res.json();
        if (json.success) {
          setProducts(json.data);
        }
      } catch (err) {
        console.error("Failed to load products:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const totalProducts = products.length;
  const completedModels = products.filter((p) => p.status === "completed").length;
  const processingModels = products.filter((p) => p.status === "processing").length;
  const failedGenerations = products.filter((p) => p.status === "failed").length;

  return (
    <DashboardLayout
      title="Studio Overview"
      subtitle="Manage your furniture catalog, 3D model generations, and Meshy AI multi-image pipelines"
    >
      <div className="space-y-8">
        {/* Hero Welcome Banner */}
        <div className="relative overflow-hidden rounded-2xl border border-stone-200/90 bg-white p-6 sm:p-8 studio-card-shadow">
          <div className="relative z-10 max-w-2xl space-y-3">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200/70 text-amber-900 text-xs font-semibold">
              <Sparkles className="h-3.5 w-3.5 text-amber-600" />
              <span>AI Multi-Image 3D Studio</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-stone-900 font-display">
              Transform furniture photographs into interactive 3D models
            </h2>
            <p className="text-xs sm:text-sm text-stone-500 max-w-xl">
              Upload 4 perspective angles (Front, Back, Left, Right). Meshy AI reconstructs realistic 3D geometries with 2K PBR materials ready for WebGL inspection and GLB export.
            </p>
            <div className="pt-2 flex flex-wrap items-center gap-3">
              <Link href="/create">
                <Button className="gap-2 bg-stone-900 hover:bg-stone-800 text-white shadow-xs">
                  <Plus className="h-4 w-4" />
                  <span>Create 3D Model</span>
                </Button>
              </Link>
              <Link href="/products">
                <Button variant="outline" className="gap-1.5 border-stone-200 text-stone-700 hover:bg-stone-50">
                  <span>View Catalog</span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
          <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-radial from-amber-50/40 via-stone-50/20 to-transparent pointer-events-none hidden md:block" />
        </div>

        {/* Metric Cards Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          <Card className="border-stone-200/80 bg-white studio-card-shadow studio-card-hover">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
                Total Products
              </span>
              <div className="h-7 w-7 rounded-lg bg-stone-100 flex items-center justify-center text-stone-600">
                <Box className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl font-bold tracking-tight text-stone-900 font-display">
                  {totalProducts}
                </div>
              )}
              <p className="text-xs text-stone-400 mt-1">Catalog items</p>
            </CardContent>
          </Card>

          <Card className="border-emerald-200/60 bg-white studio-card-shadow studio-card-hover">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">
                3D Ready
              </span>
              <div className="h-7 w-7 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
                <CheckCircle2 className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl font-bold tracking-tight text-stone-900 font-display">
                  {completedModels}
                </div>
              )}
              <p className="text-xs text-emerald-600/80 mt-1 font-medium">Interactive GLB ready</p>
            </CardContent>
          </Card>

          <Card className="border-amber-200/60 bg-white studio-card-shadow studio-card-hover">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <span className="text-xs font-semibold text-amber-700 uppercase tracking-wider">
                Processing
              </span>
              <div className="h-7 w-7 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600">
                <Clock className="h-4 w-4 animate-spin" />
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl font-bold tracking-tight text-stone-900 font-display">
                  {processingModels}
                </div>
              )}
              <p className="text-xs text-amber-600/80 mt-1 font-medium">Meshy AI generating</p>
            </CardContent>
          </Card>

          <Card className="border-stone-200/80 bg-white studio-card-shadow studio-card-hover">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
                Failed
              </span>
              <div className="h-7 w-7 rounded-lg bg-rose-50 flex items-center justify-center text-rose-500">
                <AlertTriangle className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl font-bold tracking-tight text-stone-900 font-display">
                  {failedGenerations}
                </div>
              )}
              <p className="text-xs text-stone-400 mt-1">Requires retry</p>
            </CardContent>
          </Card>
        </div>

        {/* Recent Products Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold tracking-tight text-stone-900 font-display">
                Featured 3D Scans
              </h2>
              <p className="text-xs text-stone-500">
                Inspect 3D previews and real-world dimensions
              </p>
            </div>
            <Link href="/products">
              <Button variant="ghost" size="sm" className="gap-1 text-xs text-stone-600 hover:text-stone-900">
                <span>View all products</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="p-4 space-y-3 bg-white">
                  <Skeleton className="h-48 w-full rounded-xl" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </Card>
              ))}
            </div>
          ) : products.length === 0 ? (
            <Card className="p-12 text-center border-dashed border-2 border-stone-200 bg-white studio-card-shadow">
              <div className="max-w-md mx-auto space-y-4">
                <div className="h-12 w-12 rounded-2xl bg-amber-50 text-amber-800 mx-auto flex items-center justify-center shadow-xs">
                  <Box className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-stone-900 font-display">
                    No products added yet
                  </h3>
                  <p className="text-xs text-stone-500 mt-1">
                    Upload photos of your furniture piece from 4 angles to generate your first 3D GLB model.
                  </p>
                </div>
                <Link href="/create">
                  <Button className="gap-2 bg-stone-900 hover:bg-stone-800 text-white shadow-xs">
                    <Plus className="h-4 w-4" />
                    <span>Create your first 3D model</span>
                  </Button>
                </Link>
              </div>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {products.slice(0, 6).map((product) => {
                const frontImage =
                  product.images.find((img) => img.viewType === "front")?.publicUrl ||
                  product.images[0]?.publicUrl;

                return (
                  <Card
                    key={product.id}
                    className="overflow-hidden border-stone-200/80 bg-white studio-card-shadow studio-card-hover flex flex-col group rounded-2xl"
                  >
                    {/* Image Preview & Status Badge */}
                    <div className="relative aspect-4/3 bg-stone-100 overflow-hidden">
                      {frontImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={frontImage}
                          alt={product.name}
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center text-stone-400">
                          <Box className="h-8 w-8" />
                        </div>
                      )}
                      <div className="absolute top-3 right-3">
                        <Badge
                          variant={
                            product.status === "completed"
                              ? "success"
                              : product.status === "processing"
                              ? "processing"
                              : product.status === "failed"
                              ? "destructive"
                              : "secondary"
                          }
                          className="shadow-2xs backdrop-blur-md"
                        >
                          {product.status === "completed"
                            ? "3D Ready"
                            : product.status === "processing"
                            ? "Generating..."
                            : product.status === "failed"
                            ? "Failed"
                            : "Draft"}
                        </Badge>
                      </div>
                      <div className="absolute bottom-3 left-3 bg-white/95 backdrop-blur-md text-stone-900 border border-stone-200/80 text-[11px] px-2.5 py-0.5 rounded-full font-semibold shadow-2xs">
                        {product.category}
                      </div>
                    </div>

                    {/* Content */}
                    <CardContent className="p-5 flex-1 flex flex-col justify-between space-y-4">
                      <div>
                        <h3 className="font-bold text-stone-900 text-sm tracking-tight truncate font-display">
                          {product.name}
                        </h3>
                        <p className="text-xs text-stone-500 mt-1">
                          Dimensions:{" "}
                          <span className="font-medium text-stone-800">
                            {formatDimension(product.widthMm)} × {formatDimension(product.depthMm)} × {formatDimension(product.heightMm)}
                          </span>
                        </p>
                      </div>

                      {/* Action Shortcuts */}
                      <div className="pt-3 border-t border-stone-100 flex items-center justify-between">
                        <span className="text-[11px] text-stone-400 font-medium">
                          {product.images.length}/4 angles
                        </span>
                        <div>
                          {product.status === "completed" ? (
                            <Link href={`/viewer/${product.id}`}>
                              <Button size="sm" className="gap-1.5 text-xs h-8 bg-stone-900 hover:bg-stone-800 text-white shadow-2xs">
                                <Eye className="h-3.5 w-3.5" />
                                <span>3D Studio</span>
                              </Button>
                            </Link>
                          ) : product.status === "processing" ? (
                            <Link href={`/viewer/${product.id}`}>
                              <Button size="sm" variant="secondary" className="gap-1.5 text-xs h-8">
                                <Clock className="h-3.5 w-3.5 animate-spin" />
                                <span>Status</span>
                              </Button>
                            </Link>
                          ) : (
                            <Link href={`/viewer/${product.id}`}>
                              <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8">
                                <RefreshCw className="h-3.5 w-3.5" />
                                <span>Generate</span>
                              </Button>
                            </Link>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
