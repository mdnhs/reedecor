"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  Search,
  Plus,
  Box,
  Trash2,
  Heart,
  MessageCircle,
  ExternalLink,
  Store,
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ProductGridSkeleton } from "@/components/ui/skeleton-patterns";
import { StoredProduct } from "@/server/demo-store";
import { formatDimension, cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth/auth-context";
import { buildProductShareUrl } from "@/lib/whatsapp";
import { useOrigin } from "@/lib/hooks/use-origin";
import { getProductThumbnail } from "@/lib/product-thumbnail";
import { useFeature } from "@/lib/features/features-context";

export default function MyProductsPage() {
  const { user, isCustomer } = useAuth();
  const wishlistOn = useFeature("wishlist");
  const whatsappOn = useFeature("whatsapp_contact");
  const generationOn = useFeature("model_generation");
  const origin = useOrigin();
  const [products, setProducts] = useState<StoredProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [selectedStatus, setSelectedStatus] = useState<string>("All");
  const [refreshKey, setRefreshKey] = useState(0);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [wishlistIds, setWishlistIds] = useState<Set<string>>(new Set());

  const merchantStoreId = user?.id;

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

  const processingIds = products
    .filter((p) => p.status === "processing" || p.status === "queued")
    .map((p) => p.id)
    .join(",");
  useEffect(() => {
    if (!processingIds) return;
    const timer = setInterval(async () => {
      const results = await Promise.all(
        processingIds.split(",").map((id) =>
          fetch(`/api/products/${id}/status`)
            .then((res) => res.json())
            .catch(() => null)
        )
      );
      if (results.some((json) => json?.data && json.data.status !== "processing")) {
        setRefreshKey((k) => k + 1);
      }
    }, 10_000);
    return () => clearInterval(timer);
  }, [processingIds]);

  useEffect(() => {
    let ignore = false;
    async function loadWishlist() {
      if (!user) return;
      try {
        const res = await fetch("/api/wishlists");
        const json = await res.json();
        if (!ignore && json.success && Array.isArray(json.data)) {
          setWishlistIds(new Set(json.data));
        }
      } catch (e) {
        console.error("Failed to load wishlist:", e);
      }
    }
    loadWishlist();
    return () => {
      ignore = true;
    };
  }, [user]);

  async function handleToggleWishlist(productId: string) {
    if (!user) {
      alert("Please select a user persona or sign in to save items to your wishlist.");
      return;
    }
    try {
      const res = await fetch(`/api/wishlists/${productId}/toggle`, { method: "POST" });
      const json = await res.json();
      if (json.success) {
        setWishlistIds((prev) => {
          const next = new Set(prev);
          if (json.data.inWishlist) {
            next.add(productId);
          } else {
            next.delete(productId);
          }
          return next;
        });
      }
    } catch (e) {
      console.error("Error toggling wishlist:", e);
    }
  }

  async function handleDelete(id: string) {
    if (
      !confirm(
        "Are you sure you want to delete this product? All 4 uploaded images and the generated 3D GLB model will be removed from storage."
      )
    ) {
      return;
    }

    try {
      setDeletingId(id);
      const res = await fetch(`/api/products/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (json.success) {
        setRefreshKey((k) => k + 1);
      } else {
        alert(json.error || "Failed to delete product");
      }
    } catch (err) {
      console.error("Delete failed:", err);
      alert("Delete failed. Check console for details.");
    } finally {
      setDeletingId(null);
    }
  }

  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => set.add(p.category));
    return ["All", ...Array.from(set)];
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesSearch =
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.category.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory =
        selectedCategory === "All" || p.category === selectedCategory;
      const matchesStatus =
        selectedStatus === "All" || p.status === selectedStatus;
      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [products, searchQuery, selectedCategory, selectedStatus]);

  const hasActiveFilters =
    searchQuery !== "" || selectedCategory !== "All" || selectedStatus !== "All";

  return (
    <DashboardLayout
      title="Furniture Products"
      subtitle="Your 3D catalog"
    >
      <div className="max-w-5xl space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400"
              aria-hidden="true"
            />
            <Input
              type="search"
              aria-label="Search products"
              placeholder="Search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-white pl-9"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Filter by status"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="h-9 rounded-lg border border-stone-200 bg-white px-3 text-sm text-stone-700 focus:outline-none focus:ring-2 focus:ring-stone-900"
            >
              <option value="All">All</option>
              <option value="completed">3D Ready</option>
              <option value="processing">Processing</option>
              <option value="failed">Failed</option>
              <option value="draft">Draft</option>
            </select>

            <Link
              href={`/store/${merchantStoreId}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Open public storefront"
              title="Storefront"
              className="inline-flex h-9 items-center gap-1 rounded-lg px-3 text-stone-600 hover:bg-stone-100 hover:text-stone-900"
            >
              <Store className="h-4 w-4" aria-hidden="true" />
              <ExternalLink className="h-3 w-3 text-stone-400" aria-hidden="true" />
            </Link>

            {!isCustomer && generationOn && (
              <Link href="/create">
                <Button size="sm" aria-label="Create product" className="h-9 gap-1.5 bg-gradient-brand text-white">
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  <span>Create</span>
                </Button>
              </Link>
            )}
          </div>
        </div>

        {categories.length > 2 && (
          <div
            role="group"
            aria-label="Filter by category"
            className="no-scrollbar flex items-center gap-1.5 overflow-x-auto"
          >
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                aria-pressed={selectedCategory === cat}
                onClick={() => setSelectedCategory(cat)}
                className={cn(
                  "whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition-colors",
                  selectedCategory === cat
                    ? "bg-stone-900 text-white"
                    : "text-stone-600 hover:bg-stone-100 hover:text-stone-900"
                )}
              >
                {cat === "All" ? "All" : cat}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <ProductGridSkeleton />
        ) : filteredProducts.length === 0 ? (
          <div className="glass-panel mx-auto flex max-w-md flex-col items-center gap-3 rounded-2xl p-8 text-center">
            <Box className="h-8 w-8 text-stone-400" aria-hidden="true" />
            <h3 className="font-display text-base font-semibold text-stone-900">
              {hasActiveFilters ? "No results" : "No products yet"}
            </h3>
            {hasActiveFilters ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchQuery("");
                  setSelectedCategory("All");
                  setSelectedStatus("All");
                }}
              >
                Clear filters
              </Button>
            ) : (
              !isCustomer &&
              generationOn && (
                <Link href="/create">
                  <Button size="sm" className="bg-gradient-brand text-white">
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    Create
                  </Button>
                </Link>
              )
            )}
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredProducts.map((product) => {
              const frontImage = getProductThumbnail(product);

              const isWishlisted = wishlistIds.has(product.id);
              const price = product.priceBdt > 0 ? product.priceBdt : null;

              const currentUrl = origin
                ? `${origin}/viewer/${product.id}`
                : `/viewer/${product.id}`;

              const waUrl = buildProductShareUrl({
                id: product.id,
                name: product.name,
                category: product.category,
                priceBdt: price ?? undefined,
                widthMm: product.widthMm,
                depthMm: product.depthMm,
                heightMm: product.heightMm,
                storeUrl: currentUrl,
              });

              return (
                <li key={product.id}>
                  <Card className="studio-card-shadow flex h-full flex-col overflow-hidden rounded-2xl border-stone-200/80 bg-white">
                    <Link
                      href={`/viewer/${product.id}`}
                      className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900"
                    >
                      <div className="relative aspect-4/3 overflow-hidden bg-stone-100">
                        {frontImage ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={frontImage}
                            alt={product.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-stone-400">
                            <Box className="h-8 w-8" aria-hidden="true" />
                          </div>
                        )}
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
                          className="absolute left-3 top-3 bg-white/90 backdrop-blur-md"
                        >
                          {product.status === "completed"
                            ? "3D Ready"
                            : product.status === "processing"
                            ? "Generating"
                            : product.status === "failed"
                            ? "Failed"
                            : "Draft"}
                        </Badge>
                      </div>

                      <CardContent className="space-y-1 p-4 pb-3">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="truncate font-display text-sm font-semibold text-stone-900">
                            {product.name}
                          </h3>
                          <span className="shrink-0 font-mono text-sm font-semibold text-stone-900">
                            {price ? `৳${price.toLocaleString("en-BD")}` : "—"}
                          </span>
                        </div>
                        <p className="text-xs text-stone-500">
                          {product.category} · {formatDimension(product.widthMm)} ×{" "}
                          {formatDimension(product.depthMm)} × {formatDimension(product.heightMm)}
                        </p>
                      </CardContent>
                    </Link>

                    <div className="mt-auto flex items-center justify-between gap-2 px-4 pb-4">
                      <div className="flex items-center gap-1">
                        {whatsappOn && (
                          <a
                            href={waUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`Share ${product.name} on WhatsApp`}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-xs font-medium text-emerald-700 hover:bg-emerald-50"
                          >
                            <MessageCircle className="h-4 w-4" aria-hidden="true" />
                            <span className="sr-only">Share</span>
                          </a>
                        )}
                        {wishlistOn && (
                          <button
                            type="button"
                            onClick={() => handleToggleWishlist(product.id)}
                            aria-pressed={isWishlisted}
                            aria-label={
                              isWishlisted
                                ? `Remove ${product.name} from wishlist`
                                : `Add ${product.name} to wishlist`
                            }
                            className={cn(
                              "flex h-8 w-8 items-center justify-center rounded-lg hover:bg-rose-50",
                              isWishlisted ? "text-rose-600" : "text-stone-500 hover:text-rose-600"
                            )}
                          >
                            <Heart
                              className={cn("h-4 w-4", isWishlisted && "fill-rose-500")}
                              aria-hidden="true"
                            />
                          </button>
                        )}
                      </div>
                      {!isCustomer && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-stone-500 hover:bg-rose-50 hover:text-rose-600"
                          disabled={deletingId === product.id}
                          onClick={() => handleDelete(product.id)}
                          aria-label={`Delete ${product.name}`}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </Button>
                      )}
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </DashboardLayout>
  );
}
