"use client";

import React, { useEffect, useState, use, useMemo } from "react";
import Link from "next/link";
import {
  Share2,
  Heart,
  MessageCircle,
  MapPin,
  CheckCircle2,
  Users,
  Box,
  Sparkles,
  ArrowLeft,
  Check,
  Search,
  Ruler,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ProductGridSkeleton } from "@/components/ui/skeleton-patterns";
import type { PublicStore } from "@/lib/public-store";
import { formatDimension } from "@/lib/utils";
import { useAuth } from "@/lib/auth/auth-context";
import { buildProductWhatsAppUrl, cleanWhatsAppNumber } from "@/lib/whatsapp";
import { useOrigin } from "@/lib/hooks/use-origin";
import { useFeature } from "@/lib/features/features-context";

export default function PublicStorefrontPage({
  params,
}: {
  params: Promise<{ merchantId: string }>;
}) {
  const resolvedParams = use(params);
  const merchantId = resolvedParams.merchantId;

  const { user } = useAuth();
  const wishlistOn = useFeature("wishlist");
  const whatsappOn = useFeature("whatsapp_contact");
  const origin = useOrigin();
  const [profile, setProfile] = useState<PublicStore | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [wishlistIds, setWishlistIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [copiedLink, setCopiedLink] = useState(false);
  const [followingBusy, setFollowingBusy] = useState(false);

  // 1. Fetch Merchant Profile & Products
  useEffect(() => {
    let ignore = false;
    async function fetchStore() {
      try {
        const res = await fetch(`/api/merchants/${merchantId}/public`);
        const json = await res.json();
        if (!ignore && json.success && json.data) {
          setProfile(json.data);
          setFollowerCount(json.data.followerCount ?? 0);
        }
      } catch (err) {
        console.error("Failed to load merchant storefront:", err);
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    fetchStore();
    return () => {
      ignore = true;
    };
  }, [merchantId]);

  // 2. Fetch Follow status & Wishlist if logged in
  useEffect(() => {
    let ignore = false;
    async function fetchUserData() {
      if (!user) return;
      try {
        // Follow status
        const followRes = await fetch(`/api/merchants/${merchantId}/is-following`);
        const followJson = await followRes.json();
        if (!ignore && followJson.success) {
          setIsFollowing(!!followJson.data?.isFollowing);
        }

        // Wishlists
        const wishRes = await fetch("/api/wishlists");
        const wishJson = await wishRes.json();
        if (!ignore && wishJson.success && Array.isArray(wishJson.data)) {
          setWishlistIds(new Set(wishJson.data));
        }
      } catch (e) {
        console.error("Error fetching user relation data:", e);
      }
    }
    fetchUserData();
    return () => {
      ignore = true;
    };
  }, [user, merchantId]);

  // 3. Toggle Follow Handler
  async function handleToggleFollow() {
    if (!user) {
      alert("Please log in or select a customer persona to follow this merchant.");
      return;
    }
    setFollowingBusy(true);
    try {
      if (isFollowing) {
        const res = await fetch(`/api/merchants/${merchantId}/follow`, { method: "DELETE" });
        const json = await res.json();
        if (json.success) {
          setIsFollowing(false);
          setFollowerCount((prev) => Math.max(0, prev - 1));
        }
      } else {
        const res = await fetch(`/api/merchants/${merchantId}/follow`, { method: "POST" });
        const json = await res.json();
        if (json.success) {
          setIsFollowing(true);
          setFollowerCount((prev) => prev + 1);
        }
      }
    } catch (e) {
      console.error("Error toggling follow:", e);
    } finally {
      setFollowingBusy(false);
    }
  }

  // 4. Toggle Wishlist Handler
  async function handleToggleWishlist(productId: string) {
    if (!user) {
      alert("Please log in or select a customer persona to save furniture to your wishlist.");
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

  // 5. Copy Store Link
  function handleCopyStoreLink() {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  }

  // Filter products
  const filteredProducts = useMemo(() => {
    if (!profile) return [];
    return profile.products.filter((p) => {
      const matchesSearch =
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesCategory = selectedCategory === "All" || p.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [profile, searchQuery, selectedCategory]);

  const categories = useMemo(() => {
    if (!profile) return ["All"];
    const cats = Array.from(new Set(profile.products.map((p) => p.category)));
    return ["All", ...cats];
  }, [profile]);

  if (loading) {
    return (
      <div className="min-h-screen px-4 py-8 lg:px-8">
        <div className="mx-auto max-w-6xl space-y-8">
          <Skeleton className="h-40 w-full rounded-2xl" />
          <ProductGridSkeleton count={3} />
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
        <div className="glass-panel studio-card-shadow flex max-w-md flex-col items-center gap-3 rounded-2xl p-8">
          <Box className="h-10 w-10 text-stone-400" strokeWidth={1.5} aria-hidden="true" />
          <h1 className="text-xl font-semibold text-stone-900">Store not found</h1>
          <p className="text-sm text-stone-500">
            This store doesn&apos;t exist or may have been removed.
          </p>
          <Link href="/products" className="mt-2">
            <Button variant="outline">Browse catalog</Button>
          </Link>
        </div>
      </div>
    );
  }

  const storeName = profile.businessName || profile.name || "Furniture Store";
  const merchantGeneralWaUrl =
    whatsappOn && profile.whatsappNumber
      ? `https://wa.me/${cleanWhatsAppNumber(profile.whatsappNumber)}?text=${encodeURIComponent(
          `Assalamu Alaikum! I am visiting your 3D storefront "${storeName}" and would like to inquire about your furniture collection.`
        )}`
      : null;

  return (
    <div className="min-h-screen text-stone-900 selection:bg-amber-100 selection:text-amber-900">
      <header className="sticky top-0 z-40 border-b border-white/60 bg-white/70 px-4 py-3 backdrop-blur-xl lg:px-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <Link
            href="/products"
            className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-sm font-medium text-stone-600 transition-colors hover:text-stone-900"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span>Back</span>
          </Link>

          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyStoreLink}
            aria-label="Copy store link"
            className="gap-1.5 bg-white/70"
          >
            {copiedLink ? (
              <>
                <Check className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                <span role="status">Link copied</span>
              </>
            ) : (
              <>
                <Share2 className="h-4 w-4" aria-hidden="true" />
                <span>Share</span>
              </>
            )}
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-8 px-4 py-8 lg:px-8">
        <section className="glass-panel studio-card-shadow rounded-2xl p-5 sm:p-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4 sm:gap-5">
              <div
                aria-hidden="true"
                className="bg-gradient-brand flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-2xl font-semibold text-white sm:h-20 sm:w-20 sm:text-3xl"
              >
                {storeName.charAt(0)}
              </div>

              <div className="min-w-0 space-y-1.5">
                <h1 className="text-2xl font-semibold tracking-tight text-stone-900 sm:text-3xl">
                  {storeName}
                </h1>
                {profile.name && profile.name !== storeName && (
                  <p className="text-sm text-stone-500">by {profile.name}</p>
                )}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-sm text-stone-500">
                  {profile.location && (
                    <span className="flex items-center gap-1.5">
                      <MapPin className="h-4 w-4 text-amber-600" aria-hidden="true" />
                      {profile.location}
                    </span>
                  )}
                  <span className="flex items-center gap-1.5">
                    <Users className="h-4 w-4" aria-hidden="true" />
                    <span>
                      <strong className="font-medium text-stone-800">
                        {followerCount.toLocaleString()}
                      </strong>{" "}
                      followers
                    </span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Box className="h-4 w-4" aria-hidden="true" />
                    <span>
                      <strong className="font-medium text-stone-800">
                        {profile.products.length}
                      </strong>{" "}
                      products
                    </span>
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant={isFollowing ? "outline" : "default"}
                onClick={handleToggleFollow}
                disabled={followingBusy}
                aria-pressed={isFollowing}
                className={
                  isFollowing
                    ? "h-10 flex-1 gap-2 bg-white/70 px-5 md:flex-none"
                    : "bg-gradient-brand h-10 flex-1 gap-2 px-5 text-white hover:opacity-90 md:flex-none"
                }
              >
                {isFollowing ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                    <span>Following</span>
                  </>
                ) : (
                  <>
                    <Users className="h-4 w-4" aria-hidden="true" />
                    <span>Follow</span>
                  </>
                )}
              </Button>

              {merchantGeneralWaUrl && (
                <a
                  href={merchantGeneralWaUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-md bg-emerald-600 px-5 text-sm font-medium text-white transition-colors hover:bg-emerald-700 md:flex-none"
                >
                  <MessageCircle className="h-4 w-4" aria-hidden="true" />
                  <span>WhatsApp</span>
                </a>
              )}
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div
              role="group"
              aria-label="Filter by category"
              className="scrollbar-none -mx-4 flex items-center gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0"
            >
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  aria-pressed={selectedCategory === cat}
                  className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                    selectedCategory === cat
                      ? "bg-gradient-brand text-white"
                      : "border border-stone-200 bg-white/70 text-stone-600 hover:bg-white"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-72">
              <Search
                className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400"
                aria-hidden="true"
              />
              <Input
                type="search"
                placeholder="Search this store"
                aria-label="Search products in this store"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-10 bg-white/70 pl-9 text-sm"
              />
            </div>
          </div>

          {filteredProducts.length === 0 ? (
            <div className="glass-panel studio-card-shadow space-y-3 rounded-2xl p-10 text-center">
              <Box className="mx-auto h-10 w-10 text-stone-400" strokeWidth={1.5} aria-hidden="true" />
              <h2 className="text-lg font-semibold text-stone-900">Nothing found</h2>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedCategory("All");
                  setSearchQuery("");
                }}
              >
                Reset filters
              </Button>
            </div>
          ) : (
            <ul className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {filteredProducts.map((prod) => {
                const isWishlisted = wishlistIds.has(prod.id);

                const currentUrl = origin
                  ? `${origin}/viewer/${prod.id}`
                  : `/viewer/${prod.id}`;

                const productWaUrl =
                  whatsappOn && prod.priceBdt
                    ? buildProductWhatsAppUrl(profile.whatsappNumber, {
                  id: prod.id,
                  name: prod.name,
                  category: prod.category,
                  priceBdt: prod.priceBdt,
                  widthMm: prod.widthMm,
                  depthMm: prod.depthMm,
                  heightMm: prod.heightMm,
                  storeUrl: currentUrl,
                })
                    : null;

                return (
                  <li
                    key={prod.id}
                    className="group glass-panel studio-card-shadow flex flex-col overflow-hidden rounded-2xl transition-shadow hover:shadow-lg"
                  >
                    <div className="relative">
                      <Link
                        href={`/viewer/${prod.id}`}
                        aria-label={`View ${prod.name} in 3D`}
                        className="block focus-visible:outline-2 focus-visible:outline-amber-600"
                      >
                        <div className="relative aspect-square w-full overflow-hidden bg-stone-100">
                          {prod.thumbnailUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={prod.thumbnailUrl}
                              alt={prod.name}
                              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-stone-300">
                              <Box className="h-10 w-10" aria-hidden="true" />
                            </div>
                          )}
                          <Badge className="absolute left-3 top-3 border-0 bg-white/85 text-xs font-medium text-amber-700 backdrop-blur-xs">
                            {prod.category}
                          </Badge>
                          <Badge className="absolute bottom-3 left-3 gap-1 border-0 bg-stone-900/70 text-xs font-medium text-white backdrop-blur-xs">
                            <Sparkles className="h-3 w-3" aria-hidden="true" />
                            AI-generated 3D
                          </Badge>
                        </div>
                      </Link>

                      {wishlistOn && (
                        <button
                          type="button"
                          onClick={() => handleToggleWishlist(prod.id)}
                          aria-pressed={isWishlisted}
                          aria-label={isWishlisted ? "Remove from wishlist" : "Save to wishlist"}
                          className={`absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full shadow-xs transition-colors ${
                            isWishlisted
                              ? "bg-rose-50 text-rose-600"
                              : "bg-white/85 text-stone-600 hover:bg-white hover:text-rose-600"
                          }`}
                        >
                          <Heart
                            className={`h-4 w-4 ${isWishlisted ? "fill-rose-500 text-rose-500" : ""}`}
                            aria-hidden="true"
                          />
                        </button>
                      )}
                    </div>

                    <div className="flex flex-1 flex-col gap-3 p-4">
                      <Link href={`/viewer/${prod.id}`} className="block space-y-1">
                        <h3 className="line-clamp-1 text-base font-semibold text-stone-900">
                          {prod.name}
                        </h3>
                      </Link>

                      <div className="mt-auto flex items-baseline justify-between gap-3">
                        <span className="text-lg font-semibold text-stone-900">
                          {prod.priceBdt ? `৳${prod.priceBdt.toLocaleString("en-BD")}` : "On request"}
                        </span>
                        <span className="flex items-center gap-1 font-mono text-xs text-stone-400">
                          <Ruler className="h-3.5 w-3.5" aria-hidden="true" />
                          {formatDimension(prod.widthMm)} × {formatDimension(prod.depthMm)} ×{" "}
                          {formatDimension(prod.heightMm)}
                        </span>
                      </div>

                      {productWaUrl && (
                        <a
                          href={productWaUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`Order ${prod.name} via WhatsApp`}
                          className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-emerald-600 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
                        >
                          <MessageCircle className="h-4 w-4" aria-hidden="true" />
                          <span>Order</span>
                        </a>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
