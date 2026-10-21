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
  Eye,
  Sparkles,
  ArrowLeft,
  Check,
  Search,
  ShieldCheck,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { StoredProduct } from "@/server/demo-store";
import { formatDimension } from "@/lib/utils";
import { useAuth } from "@/lib/auth/auth-context";
import { buildProductWhatsAppUrl, cleanWhatsAppNumber } from "@/lib/whatsapp";

interface MerchantProfileData {
  id: string;
  name: string;
  businessName: string;
  bio: string;
  whatsappNumber: string;
  location: string;
  avatarUrl?: string | null;
  followerCount: number;
  products: StoredProduct[];
}

export default function PublicStorefrontPage({
  params,
}: {
  params: Promise<{ merchantId: string }>;
}) {
  const resolvedParams = use(params);
  const merchantId = resolvedParams.merchantId;

  const { user } = useAuth();
  const [profile, setProfile] = useState<MerchantProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(128);
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
          setFollowerCount(json.data.followerCount || 128);
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
      <div className="min-h-screen bg-[#faf9f6] p-6 lg:p-12">
        <div className="max-w-6xl mx-auto space-y-8">
          <Skeleton className="h-48 w-full rounded-2xl" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Skeleton className="h-80 w-full rounded-xl" />
            <Skeleton className="h-80 w-full rounded-xl" />
            <Skeleton className="h-80 w-full rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-[#faf9f6] flex flex-col items-center justify-center p-6 text-center">
        <Box className="w-16 h-16 text-muted-foreground mb-4 stroke-1" />
        <h1 className="text-2xl font-bold text-neutral-900">Merchant Storefront Not Found</h1>
        <p className="text-muted-foreground mt-2 max-w-md">
          This merchant profile does not exist or may have been unlinked.
        </p>
        <Link href="/products" className="mt-6">
          <Button variant="outline">Browse Furniture Catalog</Button>
        </Link>
      </div>
    );
  }

  const merchantGeneralWaUrl = `https://wa.me/${cleanWhatsAppNumber(
    profile.whatsappNumber
  )}?text=${encodeURIComponent(
    `Assalamu Alaikum! I am visiting your 3D storefront "${profile.businessName}" and would like to inquire about your bespoke furniture collection.`
  )}`;

  return (
    <div className="min-h-screen bg-[#faf9f6] text-neutral-900 selection:bg-amber-100 selection:text-amber-900">
      {/* Top Banner Navigation */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-neutral-200/80 px-4 lg:px-8 py-3.5 transition-all">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/products"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-600 hover:text-neutral-900 bg-neutral-100 hover:bg-neutral-200/80 px-3 py-1.5 rounded-full transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Studio</span>
            </Link>
            <div className="h-4 w-px bg-neutral-300 hidden sm:block" />
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-md border border-amber-200/60 hidden sm:inline-block">
              Public Merchant Storefront
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyStoreLink}
              className="h-8 gap-1.5 text-xs border-neutral-300 hover:bg-neutral-100 text-neutral-700"
            >
              {copiedLink ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700 font-medium">Link Copied!</span>
                </>
              ) : (
                <>
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Share Storefront</span>
                </>
              )}
            </Button>

            <a
              href={merchantGeneralWaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-xs font-medium bg-[#25D366] hover:bg-[#20ba59] text-white shadow-xs transition-colors"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>WhatsApp Store</span>
            </a>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 lg:px-8 py-8 space-y-8">
        {/* Merchant Hero Profile Card */}
        <section className="bg-white rounded-2xl border border-neutral-200/80 shadow-xs p-6 lg:p-8 relative overflow-hidden">
          {/* Subtle warm decorative background accent */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-amber-50/80 via-transparent to-transparent -z-0 pointer-events-none rounded-tr-2xl" />

          <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="flex items-start sm:items-center gap-4 lg:gap-6">
              {/* Avatar */}
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-700 text-white flex items-center justify-center font-bold text-3xl sm:text-4xl shadow-md border-2 border-white ring-2 ring-amber-100 shrink-0">
                {profile.businessName.charAt(0) || "A"}
              </div>

              {/* Bio & Details */}
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900">
                    {profile.businessName}
                  </h1>
                  <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 gap-1 font-medium">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    Verified Artisan Merchant
                  </Badge>
                </div>

                <p className="text-sm text-neutral-600 max-w-2xl leading-relaxed">
                  {profile.bio}
                </p>

                <div className="flex flex-wrap items-center gap-4 text-xs text-neutral-500 pt-1">
                  <span className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-amber-600" />
                    {profile.location || "Gulshan-2, Dhaka, Bangladesh"}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-neutral-600" />
                    <strong className="text-neutral-800">{followerCount.toLocaleString()}</strong>{" "}
                    Followers
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Box className="w-3.5 h-3.5 text-neutral-600" />
                    <strong className="text-neutral-800">{profile.products.length}</strong> 3D
                    Furniture Pieces
                  </span>
                </div>
              </div>
            </div>

            {/* Merchant Actions: Follow & Direct WhatsApp */}
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto pt-2 md:pt-0 border-t md:border-t-0 border-neutral-100">
              <Button
                variant={isFollowing ? "outline" : "default"}
                onClick={handleToggleFollow}
                disabled={followingBusy}
                className={
                  isFollowing
                    ? "border-neutral-300 text-neutral-700 hover:bg-neutral-100 h-10 px-5 gap-2"
                    : "bg-neutral-900 hover:bg-neutral-800 text-white h-10 px-5 gap-2 shadow-xs"
                }
              >
                {isFollowing ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Following</span>
                  </>
                ) : (
                  <>
                    <Users className="w-4 h-4" />
                    <span>Follow Merchant</span>
                  </>
                )}
              </Button>

              <a
                href={merchantGeneralWaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 h-10 px-5 rounded-md font-medium text-sm bg-[#25D366] hover:bg-[#20ba59] text-white shadow-xs transition-colors"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Contact on WhatsApp</span>
              </a>
            </div>
          </div>
        </section>

        {/* Filter and Search Bar */}
        <section className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-2 sm:pb-0 scrollbar-none">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
                  selectedCategory === cat
                    ? "bg-neutral-900 text-white shadow-xs"
                    : "bg-white text-neutral-600 border border-neutral-200/80 hover:bg-neutral-50"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <Input
              type="text"
              placeholder="Search furniture in store..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 text-xs bg-white border-neutral-200"
            />
          </div>
        </section>

        {/* Product Catalog Grid */}
        <section>
          {filteredProducts.length === 0 ? (
            <div className="bg-white rounded-2xl border border-neutral-200 p-12 text-center space-y-3">
              <Box className="w-12 h-12 text-neutral-400 mx-auto stroke-1" />
              <h3 className="text-lg font-semibold text-neutral-800">No Furniture Models Found</h3>
              <p className="text-sm text-neutral-500 max-w-sm mx-auto">
                No items match your active filters. Try selecting a different category or clearing
                your search query.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedCategory("All");
                  setSearchQuery("");
                }}
              >
                Reset Filters
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredProducts.map((prod) => {
                const frontImg =
                  prod.images?.find((img) => img.viewType === "front")?.publicUrl ||
                  prod.images?.[0]?.publicUrl ||
                  "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800&auto=format&fit=crop";

                const isWishlisted = wishlistIds.has(prod.id);
                const has3D =
                  prod.status === "completed" ||
                  prod.generationAttempts?.some((a) => a.status === "completed" && a.modelUrl);

                // Specific WhatsApp Direct Order Link for this product
                const currentUrl =
                  typeof window !== "undefined"
                    ? `${window.location.origin}/viewer/${prod.id}`
                    : `/viewer/${prod.id}`;

                const productWaUrl = buildProductWhatsAppUrl(profile.whatsappNumber, {
                  id: prod.id,
                  name: prod.name,
                  category: prod.category,
                  priceBdt: prod.priceBdt || 18500,
                  widthMm: prod.widthMm,
                  depthMm: prod.depthMm,
                  heightMm: prod.heightMm,
                  storeUrl: currentUrl,
                });

                return (
                  <Card
                    key={prod.id}
                    className="group bg-white rounded-xl border border-neutral-200/80 overflow-hidden hover:border-amber-300 hover:shadow-md transition-all flex flex-col justify-between"
                  >
                    <div>
                      {/* Image Frame */}
                      <div className="relative aspect-4/3 w-full bg-neutral-100 overflow-hidden">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={frontImg}
                          alt={prod.name}
                          className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-300"
                        />

                        {/* Top Badges */}
                        <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
                          {has3D ? (
                            <Badge className="bg-emerald-500/90 hover:bg-emerald-600 text-white border-0 text-[10px] tracking-wide font-medium shadow-xs gap-1 backdrop-blur-xs">
                              <Sparkles className="w-3 h-3" />
                              3D Ready
                            </Badge>
                          ) : (
                            <Badge className="bg-neutral-800/80 text-white border-0 text-[10px] tracking-wide font-medium backdrop-blur-xs">
                              Draft Model
                            </Badge>
                          )}
                          <Badge className="bg-white/90 text-neutral-800 border-neutral-200 text-[10px] font-medium backdrop-blur-xs">
                            {prod.category}
                          </Badge>
                        </div>

                        {/* Wishlist Heart Button */}
                        <button
                          type="button"
                          onClick={() => handleToggleWishlist(prod.id)}
                          className={`absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                            isWishlisted
                              ? "bg-rose-50 text-rose-600 shadow-sm"
                              : "bg-white/80 text-neutral-600 hover:bg-white hover:text-rose-600 shadow-xs"
                          }`}
                          title={isWishlisted ? "Remove from Wishlist" : "Save to Wishlist"}
                        >
                          <Heart
                            className={`w-4 h-4 ${isWishlisted ? "fill-rose-500 text-rose-500" : ""}`}
                          />
                        </button>
                      </div>

                      {/* Content */}
                      <CardContent className="p-4 space-y-3">
                        <div>
                          <h3 className="font-semibold text-base text-neutral-900 group-hover:text-amber-800 transition-colors line-clamp-1">
                            {prod.name}
                          </h3>
                          {prod.description && (
                            <p className="text-xs text-neutral-500 line-clamp-2 mt-1 leading-relaxed">
                              {prod.description}
                            </p>
                          )}
                        </div>

                        {/* Dimensions & Specifications */}
                        <div className="flex items-center justify-between text-xs text-neutral-500 pt-1 border-t border-neutral-100">
                          <span>Dimensions</span>
                          <span className="font-mono text-neutral-700">
                            {formatDimension(prod.widthMm)} × {formatDimension(prod.depthMm)} ×{" "}
                            {formatDimension(prod.heightMm)}
                          </span>
                        </div>

                        {/* Purchase Price */}
                        <div className="flex items-baseline justify-between pt-1">
                          <span className="text-xs text-neutral-500">Purchase Price</span>
                          <span className="text-lg font-bold text-neutral-900">
                            ৳{(prod.priceBdt || 18500).toLocaleString("en-BD")}
                          </span>
                        </div>
                      </CardContent>
                    </div>

                    {/* Action Footer */}
                    <div className="p-4 pt-0 grid grid-cols-2 gap-2">
                      <Link href={`/viewer/${prod.id}`} className="w-full">
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full text-xs h-9 border-neutral-200 hover:bg-neutral-50 gap-1.5"
                        >
                          <Eye className="w-3.5 h-3.5 text-neutral-600" />
                          <span>View 3D</span>
                        </Button>
                      </Link>

                      <a
                        href={productWaUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full"
                      >
                        <Button
                          size="sm"
                          className="w-full text-xs h-9 bg-[#25D366] hover:bg-[#20ba59] text-white gap-1.5 shadow-xs"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          <span>WhatsApp</span>
                        </Button>
                      </a>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
