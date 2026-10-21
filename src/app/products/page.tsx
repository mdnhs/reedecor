"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  Search,
  Plus,
  Box,
  Eye,
  Trash2,
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { StoredProduct } from "@/server/demo-store";
import { formatDimension, cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth/auth-context";

export default function MyProductsPage() {
  const { isCustomer } = useAuth();
  const [products, setProducts] = useState<StoredProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [selectedStatus, setSelectedStatus] = useState<string>("All");
  const [refreshKey, setRefreshKey] = useState(0);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    async function loadProducts() {
      try {
        const res = await fetch("/api/products");
        const json = await res.json();
        if (!ignore && json.success) {
          setProducts(json.data);
        }
      } catch (err) {
        console.error("Failed to load products:", err);
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }
    loadProducts();
    return () => {
      ignore = true;
    };
  }, [refreshKey]);

  async function handleDelete(id: string) {
    if (
      !confirm(
        "Are you sure you want to delete this product? All 4 uploaded images and the generated 3D GLB model will be removed from storage."
      )
    ) {
      return;
    }
    setDeletingId(id);
    try {
      const res = await fetch(`/api/products/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (json.success) {
        setProducts((prev) => prev.filter((p) => p.id !== id));
        setRefreshKey((k) => k + 1);
      }
    } catch (err) {
      console.error("Failed to delete product:", err);
    } finally {
      setDeletingId(null);
    }
  }

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesSearch =
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.category.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCategory =
        selectedCategory === "All" || product.category === selectedCategory;

      const matchesStatus =
        selectedStatus === "All" ||
        (selectedStatus === "completed" && product.status === "completed") ||
        (selectedStatus === "processing" && product.status === "processing") ||
        (selectedStatus === "failed" && product.status === "failed") ||
        (selectedStatus === "draft" && product.status === "draft");

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [products, searchQuery, selectedCategory, selectedStatus]);

  const categories = [
    "All",
    "Chair",
    "Sofa",
    "Table",
    "Bed",
    "Cabinet",
    "Home Decor",
    "Other",
  ];

  return (
    <DashboardLayout
      title="My Products"
      subtitle="View, inspect, and manage your 3D furniture catalogue"
    >
      <div className="space-y-6">
        {/* Search & Top Action Bar */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-stretch sm:items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-stone-400" />
            <Input
              placeholder="Search products by name or category..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-white border-stone-200/90 shadow-2xs"
            />
          </div>

          <div className="flex items-center gap-3">
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="h-9 px-3 rounded-xl border border-stone-200 bg-white text-xs font-semibold text-stone-700 shadow-2xs focus:outline-none focus:ring-1 focus:ring-stone-900"
            >
              <option value="All">All Statuses</option>
              <option value="completed">3D Ready</option>
              <option value="processing">Processing</option>
              <option value="failed">Failed</option>
              <option value="draft">Draft</option>
            </select>

            {!isCustomer && (
              <Link href="/create">
                <Button size="sm" className="gap-2 bg-amber-700 hover:bg-amber-800 text-white shadow-xs">
                  <Plus className="h-4 w-4" />
                  <span>Create Product</span>
                </Button>
              </Link>
            )}
          </div>
        </div>

        {/* Category Horizontal Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={cn(
                "px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-150",
                selectedCategory === cat
                  ? "bg-stone-900 text-white shadow-2xs"
                  : "bg-white border border-stone-200/80 text-stone-600 hover:bg-stone-100 hover:text-stone-900"
              )}
            >
              {cat === "All" ? "All Categories" : cat}
            </button>
          ))}
        </div>

        {/* Product Cards Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i} className="p-4 space-y-3 bg-white">
                <Skeleton className="h-48 w-full rounded-xl" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </Card>
            ))}
          </div>
        ) : filteredProducts.length === 0 ? (
          <Card className="p-12 text-center border-dashed border-2 border-stone-200 bg-white studio-card-shadow">
            <div className="max-w-md mx-auto space-y-4">
              <div className="h-12 w-12 rounded-2xl bg-stone-100 text-stone-500 mx-auto flex items-center justify-center">
                <Box className="h-6 w-6" />
              </div>
              <h3 className="text-base font-semibold text-stone-900 font-display">
                No matching products found
              </h3>
              <p className="text-xs text-stone-500">
                Try adjusting your search filter or add a new piece of furniture.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchQuery("");
                  setSelectedCategory("All");
                  setSelectedStatus("All");
                }}
              >
                Reset filters
              </Button>
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProducts.map((product) => {
              const frontImage =
                product.images.find((img) => img.viewType === "front")?.publicUrl ||
                product.images[0]?.publicUrl;

              return (
                <Card
                  key={product.id}
                  className="overflow-hidden border-stone-200/80 bg-white studio-card-shadow studio-card-hover flex flex-col justify-between group rounded-2xl"
                >
                  <div>
                    {/* Image Preview & Badges */}
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

                    {/* Meta info */}
                    <CardContent className="p-5 space-y-2">
                      <h3 className="font-bold text-stone-900 text-sm tracking-tight truncate font-display">
                        {product.name}
                      </h3>
                      {product.description && (
                        <p className="text-xs text-stone-500 line-clamp-2">
                          {product.description}
                        </p>
                      )}
                      <div className="pt-2 text-xs text-stone-600 flex items-center justify-between">
                        <span>
                          Dimensions:{" "}
                          <strong className="text-stone-800">
                            {formatDimension(product.widthMm)} × {formatDimension(product.depthMm)} × {formatDimension(product.heightMm)}
                          </strong>
                        </span>
                      </div>
                    </CardContent>
                  </div>

                  {/* Actions Bar */}
                  <div className="p-4 pt-0 border-t border-stone-100 mt-2 flex items-center justify-between">
                    <span className="text-[11px] text-stone-400 font-medium">
                      {new Date(product.createdAt).toLocaleDateString()}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <Link href={`/viewer/${product.id}`}>
                        <Button
                          size="sm"
                          variant={product.status === "completed" ? "default" : "outline"}
                          className={`gap-1.5 text-xs h-8 ${
                            product.status === "completed"
                              ? "bg-stone-900 hover:bg-stone-800 text-white shadow-2xs"
                              : "border-stone-200 text-stone-700 hover:bg-stone-100"
                          }`}
                        >
                          <Eye className="h-3.5 w-3.5" />
                          <span>
                            {product.status === "completed" ? "3D Studio" : "Inspect"}
                          </span>
                        </Button>
                      </Link>

                      {!isCustomer && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-stone-400 hover:text-rose-600 hover:bg-rose-50"
                          disabled={deletingId === product.id}
                          onClick={() => handleDelete(product.id)}
                          title="Delete product"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
