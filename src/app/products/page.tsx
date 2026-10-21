"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  Search,
  Plus,
  Box,
  Eye,
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
import { Skeleton } from "@/components/ui/skeleton";
import { StoredProduct } from "@/server/demo-store";
import { formatDimension, cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth/auth-context";
import { buildProductWhatsAppUrl } from "@/lib/whatsapp";
import { useOrigin } from "@/lib/hooks/use-origin";

export default function MyProductsPage() {
  const { user, isCustomer } = useAuth();
  const origin = useOrigin();
  const [products, setProducts] = useState<StoredProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [selectedStatus, setSelectedStatus] = useState<string>("All");
  const [refreshKey, setRefreshKey] = useState(0);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [wishlistIds, setWishlistIds] = useState<Set<string>>(new Set());

  const merchantStoreId = user?.id || "demo-merchant-001";

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

  return (
    <DashboardLayout
      title="Furniture Products"
      subtitle="Manage your 3D furniture catalog, purchase prices, and customer WhatsApp orders"
    >
      <div className="space-y-6 max-w-7xl">
        {/* Top Controls Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <Input
              placeholder="Search products by name or category..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-white border-stone-200/90 shadow-2xs"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="h-9 px-3 rounded-lg border border-stone-200 bg-white text-xs font-semibold text-stone-700 shadow-2xs focus:outline-none focus:ring-1 focus:ring-stone-900"
            >
              <option value="All">All Statuses</option>
              <option value="completed">3D Ready</option>
              <option value="processing">Processing</option>
              <option value="failed">Failed</option>
              <option value="draft">Draft</option>
            </select>

            <Link href={`/store/${merchantStoreId}`} target="_blank">
              <Button size="sm" variant="outline" className="gap-1.5 border-stone-200 text-stone-700 text-xs h-9">
                <Store className="h-3.5 w-3.5 text-amber-700" />
                <span>Public Storefront</span>
                <ExternalLink className="h-3 w-3 text-stone-400" />
              </Button>
            </Link>

            {!isCustomer && (
              <Link href="/create">
                <Button size="sm" className="gap-2 bg-amber-700 hover:bg-amber-800 text-white shadow-xs h-9">
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

              const isWishlisted = wishlistIds.has(product.id);
              const price = product.priceBdt || 18500;

              const currentUrl = origin
                ? `${origin}/viewer/${product.id}`
                : `/viewer/${product.id}`;

              const waUrl = buildProductWhatsAppUrl("01865818044", {
                id: product.id,
                name: product.name,
                category: product.category,
                priceBdt: price,
                widthMm: product.widthMm,
                depthMm: product.depthMm,
                heightMm: product.heightMm,
                storeUrl: currentUrl,
              });

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

                      <div className="absolute top-3 right-3 flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleToggleWishlist(product.id)}
                          className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                            isWishlisted
                              ? "bg-rose-50 text-rose-600 shadow-xs"
                              : "bg-white/80 text-stone-600 hover:bg-white hover:text-rose-600 shadow-2xs"
                          }`}
                          title={isWishlisted ? "In Wishlist" : "Add to Wishlist"}
                        >
                          <Heart
                            className={`w-3.5 h-3.5 ${
                              isWishlisted ? "fill-rose-500 text-rose-500" : ""
                            }`}
                          />
                        </button>

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
                          className="shadow-2xs backdrop-blur-md text-[10px]"
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
                    <CardContent className="p-5 space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-bold text-stone-900 text-sm tracking-tight truncate font-display">
                          {product.name}
                        </h3>
                        <span className="font-bold text-stone-900 text-sm shrink-0 font-mono">
                          ৳{price.toLocaleString("en-BD")}
                        </span>
                      </div>

                      {product.description && (
                        <p className="text-xs text-stone-500 line-clamp-2">
                          {product.description}
                        </p>
                      )}

                      <div className="pt-1 text-xs text-stone-600 flex items-center justify-between border-t border-stone-100">
                        <span>Dimensions</span>
                        <strong className="text-stone-800 font-mono text-[11px]">
                          {formatDimension(product.widthMm)} × {formatDimension(product.depthMm)} × {formatDimension(product.heightMm)}
                        </strong>
                      </div>
                    </CardContent>
                  </div>

                  {/* Actions Bar */}
                  <div className="p-4 pt-0 border-t border-stone-100 mt-2 flex items-center justify-between">
                    <a
                      href={waUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1.5 rounded-lg transition-colors"
                      title="Send WhatsApp message about this piece"
                    >
                      <MessageCircle className="h-3.5 w-3.5 text-[#25D366]" />
                      <span>WhatsApp</span>
                    </a>

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
