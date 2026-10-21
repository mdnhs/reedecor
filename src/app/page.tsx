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
      subtitle="Track your furniture catalog, 3D model generations, and Meshy AI tasks"
    >
      <div className="space-y-8">
        {/* Metric Cards Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          <Card className="border-stone-200/80 bg-white">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <span className="text-xs font-medium text-stone-500 uppercase tracking-wider">
                Total Products
              </span>
              <Box className="h-4 w-4 text-stone-400" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl font-bold tracking-tight text-stone-900">
                  {totalProducts}
                </div>
              )}
              <p className="text-xs text-stone-500 mt-1">In merchant catalog</p>
            </CardContent>
          </Card>

          <Card className="border-emerald-100 bg-white dark:border-emerald-900/30">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <span className="text-xs font-medium text-emerald-600 uppercase tracking-wider">
                Generated 3D
              </span>
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl font-bold tracking-tight text-stone-900">
                  {completedModels}
                </div>
              )}
              <p className="text-xs text-stone-500 mt-1">Interactive GLB ready</p>
            </CardContent>
          </Card>

          <Card className="border-amber-100 bg-white dark:border-amber-900/30">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <span className="text-xs font-medium text-amber-600 uppercase tracking-wider">
                Processing
              </span>
              <Clock className="h-4 w-4 text-amber-500 animate-spin" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl font-bold tracking-tight text-stone-900">
                  {processingModels}
                </div>
              )}
              <p className="text-xs text-stone-500 mt-1">Meshy AI working</p>
            </CardContent>
          </Card>

          <Card className="border-stone-200/80 bg-white">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <span className="text-xs font-medium text-stone-500 uppercase tracking-wider">
                Failed
              </span>
              <AlertTriangle className="h-4 w-4 text-stone-400" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl font-bold tracking-tight text-stone-900">
                  {failedGenerations}
                </div>
              )}
              <p className="text-xs text-stone-500 mt-1">Requires retry</p>
            </CardContent>
          </Card>
        </div>

        {/* Primary Action & Recent Products Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-stone-900">
                Recent Products
              </h2>
              <p className="text-xs text-stone-500">
                Manage your multi-angle furniture scans and 3D preview statuses
              </p>
            </div>
            <Link href="/products">
              <Button variant="ghost" size="sm" className="gap-1 text-xs">
                <span>View all products</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="p-4 space-y-3">
                  <Skeleton className="h-44 w-full rounded-lg" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </Card>
              ))}
            </div>
          ) : products.length === 0 ? (
            /* Empty State */
            <Card className="p-12 text-center border-dashed border-2 border-stone-200 bg-white">
              <div className="max-w-md mx-auto space-y-4">
                <div className="h-12 w-12 rounded-full bg-amber-50 text-amber-800 mx-auto flex items-center justify-center">
                  <Box className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-stone-900">
                    No products added yet
                  </h3>
                  <p className="text-xs text-stone-500 mt-1">
                    Upload photos of your furniture piece from 4 angles (Front, Back, Left, Right) to generate your first 3D GLB model.
                  </p>
                </div>
                <Link href="/create">
                  <Button className="gap-2">
                    <Plus className="h-4 w-4" />
                    <span>Create your first 3D model</span>
                  </Button>
                </Link>
              </div>
            </Card>
          ) : (
            /* Recent Products Grid */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {products.slice(0, 6).map((product) => {
                const frontImage =
                  product.images.find((img) => img.viewType === "front")?.publicUrl ||
                  product.images[0]?.publicUrl;

                return (
                  <Card
                    key={product.id}
                    className="overflow-hidden border-stone-200/80 bg-white hover:shadow-md transition-shadow flex flex-col"
                  >
                    {/* Image Preview & Status Badge */}
                    <div className="relative aspect-4/3 bg-stone-100 overflow-hidden">
                      {frontImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={frontImage}
                          alt={product.name}
                          className="h-full w-full object-cover transition-transform hover:scale-105 duration-300"
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
                      <div className="absolute bottom-3 left-3 bg-stone-950/70 backdrop-blur-xs text-white text-[11px] px-2 py-0.5 rounded-md font-medium">
                        {product.category}
                      </div>
                    </div>

                    {/* Content */}
                    <CardContent className="p-4 flex-1 flex flex-col justify-between">
                      <div>
                        <h3 className="font-semibold text-stone-900 text-sm tracking-tight truncate">
                          {product.name}
                        </h3>
                        <p className="text-xs text-stone-500 mt-1">
                          Dimensions:{" "}
                          <span className="font-medium text-stone-700">
                            {formatDimension(product.widthMm)} × {formatDimension(product.depthMm)} × {formatDimension(product.heightMm)}
                          </span>
                        </p>
                      </div>

                      {/* Action Shortcuts */}
                      <div className="mt-4 pt-3 border-t border-stone-100 flex items-center justify-between">
                        <span className="text-[11px] text-stone-400">
                          {product.images.length}/4 angles
                        </span>
                        <div className="flex gap-2">
                          {product.status === "completed" ? (
                            <Link href={`/viewer/${product.id}`}>
                              <Button size="sm" variant="default" className="gap-1.5 text-xs h-8">
                                <Eye className="h-3.5 w-3.5" />
                                <span>3D Studio</span>
                              </Button>
                            </Link>
                          ) : product.status === "processing" ? (
                            <Link href={`/viewer/${product.id}`}>
                              <Button size="sm" variant="secondary" className="gap-1.5 text-xs h-8">
                                <Clock className="h-3.5 w-3.5 animate-spin" />
                                <span>View Status</span>
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
