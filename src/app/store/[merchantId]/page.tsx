"use client";

import React, { useEffect, useState, use, useMemo } from "react";
import Link from "next/link";
import {
  Share2,
  MessageCircle,
  MapPin,
  CheckCircle2,
  Box,
  Sparkles,
  Check,
  Search,
  Ruler,
  Grid,
  List,
  X,
  Info,
  Building2,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { StorefrontSkeleton } from "@/components/store/storefront-skeleton";
import type { PublicStore, PublicProduct } from "@/lib/public-store";
import { formatDimension, cn } from "@/lib/utils";
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

  const whatsappOn = useFeature("whatsapp_contact");
  const origin = useOrigin();

  const [profile, setProfile] = useState<PublicStore | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [sortBy, setSortBy] = useState<"featured" | "price-asc" | "price-desc" | "name">("featured");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [copiedLink, setCopiedLink] = useState(false);
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [copiedPhone, setCopiedPhone] = useState(false);
  const [activePreviewProduct, setActivePreviewProduct] = useState<PublicProduct | null>(null);

  // 1. Fetch Merchant Profile & Products from Supabase via API
  useEffect(() => {
    let ignore = false;
    async function fetchStore() {
      try {
        const res = await fetch(`/api/merchants/${merchantId}/public`);
        const json = await res.json();
        if (!ignore && json.success && json.data) {
          setProfile(json.data);
        }
      } catch (err) {
        console.error("Failed to load merchant storefront from database:", err);
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    fetchStore();
    return () => {
      ignore = true;
    };
  }, [merchantId]);

  // 2. Copy Store Link
  function handleCopyStoreLink() {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  }

  // 3. Copy Phone Number
  function handleCopyPhone(phone: string) {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(phone);
      setCopiedPhone(true);
      setTimeout(() => setCopiedPhone(false), 2500);
    }
  }

  // Filter & sort products from real database
  const filteredProducts = useMemo(() => {
    if (!profile) return [];
    let list = profile.products.filter((p) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        (p.description && p.description.toLowerCase().includes(q));
      const matchesCategory = selectedCategory === "All" || p.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });

    if (sortBy === "price-asc") {
      list = [...list].sort((a, b) => (a.priceBdt ?? 0) - (b.priceBdt ?? 0));
    } else if (sortBy === "price-desc") {
      list = [...list].sort((a, b) => (b.priceBdt ?? 0) - (a.priceBdt ?? 0));
    } else if (sortBy === "name") {
      list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    }

    return list;
  }, [profile, searchQuery, selectedCategory, sortBy]);

  // Categories dynamically derived from REAL products in Supabase
  const categoryStats = useMemo(() => {
    if (!profile) return [{ name: "All", count: 0 }];
    const counts: Record<string, number> = {};

    for (const p of profile.products) {
      counts[p.category] = (counts[p.category] || 0) + 1;
    }

    const list = Object.keys(counts).map((cat) => ({
      name: cat,
      count: counts[cat],
    }));

    return [{ name: "All", count: profile.products.length }, ...list];
  }, [profile]);

  if (loading) {
    return <StorefrontSkeleton />;
  }

  if (!profile) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
        <div className="glass-panel studio-card-shadow flex max-w-md flex-col items-center gap-4 rounded-3xl p-10 text-stone-900">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-stone-100 text-stone-400">
            <Box className="h-8 w-8" strokeWidth={1.5} aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-bold">Store Not Found</h1>
          <p className="text-sm text-stone-500">
            This merchant profile was not found in the database.
          </p>
          <Link href="/products" className="mt-2">
            <Button className="bg-gradient-brand text-white font-semibold">
              Browse Shop Directory
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const storeName = profile.businessName || profile.name || "Artisan 3D Shop";
  const initials = storeName
    .split(" ")
    .map((word) => word.charAt(0))
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const merchantGeneralWaUrl =
    whatsappOn && profile.whatsappNumber
      ? `https://wa.me/${cleanWhatsAppNumber(profile.whatsappNumber)}?text=${encodeURIComponent(
          `Assalamu Alaikum! I am visiting your 3D storefront "${storeName}" and would like to inquire about your furniture collection.`
        )}`
      : null;

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-stone-900 selection:bg-indigo-100 selection:text-indigo-950 font-sans">
      {/* 1. COMPACT MINIMAL HERO */}
      <section className="border-b border-stone-200/60 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-5 sm:py-6 lg:px-8">
          {/* Top category label & badge */}
          <div className="mb-3.5 flex items-center justify-between">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-stone-200/80 bg-stone-50 px-2.5 py-0.5 text-[11px] font-semibold text-stone-600">
              <Sparkles className="h-3 w-3 text-indigo-600" />
              <span>3D Digital Showroom</span>
            </div>
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            {/* Identity */}
            <div className="flex items-center gap-3.5">
              {/* Compact Logo */}
              <div className="relative shrink-0">
                <div className="flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center overflow-hidden rounded-2xl border border-stone-200 bg-gradient-brand shadow-xs">
                  {profile.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={profile.logoUrl}
                      alt={storeName}
                      className="h-full w-full object-cover bg-white"
                    />
                  ) : (
                    <span className="font-serif text-2xl font-black text-white">
                      {initials || storeName.charAt(0)}
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5">
                  <h1 className="text-xl sm:text-2xl font-black tracking-tight text-stone-950">
                    {storeName}
                  </h1>
                  <span title="Verified Scale Accuracy" className="inline-flex items-center">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  </span>
                </div>

                {profile.bio ? (
                  <p className="line-clamp-1 text-xs text-stone-500 max-w-md">
                    {profile.bio}
                  </p>
                ) : profile.name && profile.name !== storeName ? (
                  <p className="text-xs text-stone-500">
                    By <span className="font-medium text-stone-700">{profile.name}</span>
                  </p>
                ) : null}

                <div className="flex items-center gap-2.5 text-[11px] font-medium text-stone-500 pt-0.5">
                  {profile.location && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3 text-stone-400" />
                      <span>{profile.location}</span>
                    </span>
                  )}
                  {profile.location && <span>•</span>}
                  <span>{profile.products.length} {profile.products.length === 1 ? "Product" : "Products"}</span>
                  <span>•</span>
                  <span>1:1 Scale 3D Models</span>
                </div>
              </div>
            </div>

            {/* Compact Actions (Share, WhatsApp, Info) */}
            <div className="flex flex-wrap items-center gap-2 pt-1 sm:pt-0">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyStoreLink}
                aria-label="Share shop"
                className="h-9 rounded-xl border-stone-200/90 bg-white px-3 text-xs font-semibold text-stone-700 hover:bg-stone-50 shadow-2xs gap-1.5"
              >
                {copiedLink ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                    <span className="text-emerald-700">Copied</span>
                  </>
                ) : (
                  <>
                    <Share2 className="h-3.5 w-3.5 text-stone-500" />
                    <span>Share</span>
                  </>
                )}
              </Button>

              {merchantGeneralWaUrl && (
                <a
                  href={merchantGeneralWaUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-[#25D366] px-3.5 text-xs font-bold text-white shadow-2xs hover:bg-[#20bd5a] transition-colors"
                >
                  <MessageCircle className="h-3.5 w-3.5 fill-white text-white" />
                  <span>WhatsApp</span>
                </a>
              )}

              {profile.whatsappNumber && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setContactModalOpen(true)}
                  aria-label="Shop Info"
                  className="h-9 rounded-xl border-stone-200/90 bg-white px-2.5 text-xs font-semibold text-stone-700 hover:bg-stone-50 shadow-2xs"
                >
                  <Info className="h-3.5 w-3.5 text-stone-500" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* 2. MAIN CATALOG SECTION (Compact Toolbar & Visual Products) */}
      <section className="mx-auto max-w-7xl px-4 py-6 lg:px-8 space-y-5">
        {/* Compact Filters & Controls Row */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Category Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            {categoryStats.map((item) => {
              const isSelected = selectedCategory === item.name;
              return (
                <button
                  key={item.name}
                  type="button"
                  onClick={() => setSelectedCategory(item.name)}
                  aria-pressed={isSelected}
                  className={cn(
                    "rounded-full px-3.5 py-1 text-xs font-semibold transition-all",
                    isSelected
                      ? "bg-indigo-600 text-white shadow-xs"
                      : "bg-white text-stone-600 border border-stone-200/80 hover:bg-stone-50 hover:text-stone-900"
                  )}
                >
                  {item.name}
                  <span className="ml-1.5 text-[10px] opacity-75">{item.count}</span>
                </button>
              );
            })}
          </div>

          {/* Search, Sort, View Controls */}
          <div className="flex items-center gap-2">
            <div className="relative w-44 sm:w-56">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-stone-400" />
              <Input
                type="search"
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8.5 rounded-xl border-stone-200/80 bg-white pl-8 pr-7 text-xs text-stone-900 placeholder:text-stone-400 focus-visible:border-indigo-600"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="h-8.5 rounded-xl border border-stone-200/80 bg-white px-2.5 text-xs font-medium text-stone-700 focus:outline-none focus:border-indigo-600 shadow-2xs"
            >
              <option value="featured">Featured</option>
              <option value="price-asc">Price: Low to High</option>
              <option value="price-desc">Price: High to Low</option>
              <option value="name">Name</option>
            </select>

            <div className="flex items-center rounded-xl border border-stone-200/80 bg-white p-0.5 shadow-2xs">
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                aria-label="Grid view"
                className={cn(
                  "flex h-7.5 w-7.5 items-center justify-center rounded-lg transition-colors",
                  viewMode === "grid" ? "bg-indigo-600 text-white shadow-2xs" : "text-stone-400 hover:text-stone-900"
                )}
              >
                <Grid className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("list")}
                aria-label="List view"
                className={cn(
                  "flex h-7.5 w-7.5 items-center justify-center rounded-lg transition-colors",
                  viewMode === "list" ? "bg-indigo-600 text-white shadow-2xs" : "text-stone-400 hover:text-stone-900"
                )}
              >
                <List className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* 3. PRODUCTS LIST */}
        {filteredProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-stone-200/80 bg-white p-12 text-center shadow-2xs">
            <Box className="h-10 w-10 text-stone-300" />
            <h3 className="text-base font-bold text-stone-800">No products found</h3>
            <p className="text-xs text-stone-500">
              Try adjusting your search or category filter.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSelectedCategory("All");
                setSearchQuery("");
              }}
              className="mt-1 h-8 rounded-lg text-xs"
            >
              Reset
            </Button>
          </div>
        ) : viewMode === "grid" ? (
          /* COMPACT VISUAL GRID */
          <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filteredProducts.map((prod) => {
              const currentUrl = origin ? `${origin}/viewer/${prod.id}` : `/viewer/${prod.id}`;
              const productWaUrl =
                whatsappOn && profile.whatsappNumber && prod.priceBdt
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
                  className="group relative flex flex-col overflow-hidden rounded-2xl border border-stone-200/80 bg-white shadow-2xs transition-all hover:shadow-md"
                >
                  {/* Clean Image Canvas */}
                  <div className="relative aspect-[4/3] w-full overflow-hidden bg-stone-50 flex items-center justify-center">
                    <Link
                      href={`/viewer/${prod.id}`}
                      aria-label={`View ${prod.name} in 3D`}
                      className="block h-full w-full"
                    >
                      {prod.thumbnailUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={prod.thumbnailUrl}
                          alt={prod.name}
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-stone-300">
                          <Box className="h-10 w-10" />
                        </div>
                      )}
                    </Link>

                    {/* Category */}
                    <span className="absolute top-2.5 left-2.5 rounded-full border border-stone-200/80 bg-white/95 px-2.5 py-0.5 text-[10px] font-bold text-indigo-700 shadow-2xs backdrop-blur-xs">
                      {prod.category}
                    </span>

                    {/* Quick Preview & Wishlist Buttons */}
                    <div className="absolute top-2.5 right-2.5 flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setActivePreviewProduct(prod)}
                        aria-label={`Preview ${prod.name}`}
                        className="flex h-7.5 w-7.5 items-center justify-center rounded-full border border-stone-200/80 bg-white/95 text-stone-600 hover:text-indigo-600 shadow-2xs backdrop-blur-xs transition-colors"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {/* 3D badge */}
                    <div className="absolute bottom-2.5 left-2.5 inline-flex items-center gap-1 rounded-full border border-stone-200/80 bg-white/95 px-2 py-0.5 text-[10px] font-bold text-indigo-700 shadow-2xs backdrop-blur-xs">
                      <Sparkles className="h-2.5 w-2.5 text-amber-500" />
                      <span>3D</span>
                    </div>

                    {/* Dimensions */}
                    <div className="absolute bottom-2.5 right-2.5 rounded-full border border-stone-200/80 bg-white/95 px-2 py-0.5 font-mono text-[10px] font-semibold text-stone-600 shadow-2xs backdrop-blur-xs">
                      {formatDimension(prod.widthMm)}×{formatDimension(prod.depthMm)}
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="p-3.5 space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <Link href={`/viewer/${prod.id}`}>
                        <h3 className="text-sm font-bold text-stone-900 group-hover:text-indigo-600 line-clamp-1">
                          {prod.name}
                        </h3>
                      </Link>

                      <div className="text-sm font-black text-stone-950 shrink-0">
                        {prod.priceBdt ? `৳${prod.priceBdt.toLocaleString("en-BD")}` : "Custom"}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5 pt-1 border-t border-stone-100">
                      <Link
                        href={`/viewer/${prod.id}`}
                        className="inline-flex h-8.5 items-center justify-center gap-1 rounded-lg bg-gradient-brand text-[11px] font-bold text-white transition-all shadow-xs hover:opacity-95"
                      >
                        <Box className="h-3 w-3" />
                        <span>Inspect 3D</span>
                      </Link>

                      {productWaUrl ? (
                        <a
                          href={productWaUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex h-8.5 items-center justify-center gap-1 rounded-lg bg-[#25D366] text-[11px] font-bold text-white shadow-xs transition-all hover:bg-[#20bd5a]"
                        >
                          <MessageCircle className="h-3 w-3 fill-white" />
                          <span>Order</span>
                        </a>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setContactModalOpen(true)}
                          className="h-8.5 rounded-lg border-stone-200 text-[11px] font-medium"
                        >
                          Inquire
                        </Button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          /* COMPACT LIST VIEW */
          <ul className="space-y-3">
            {filteredProducts.map((prod) => {
              const currentUrl = origin ? `${origin}/viewer/${prod.id}` : `/viewer/${prod.id}`;
              const productWaUrl =
                whatsappOn && profile.whatsappNumber && prod.priceBdt
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
                  className="group relative flex flex-col gap-3 rounded-2xl border border-stone-200/80 bg-white p-3 shadow-2xs transition-all hover:shadow-md sm:flex-row sm:items-center sm:gap-4 sm:p-3.5"
                >
                  <div className="relative h-32 w-full sm:h-20 sm:w-28 shrink-0 overflow-hidden rounded-xl bg-stone-50 border border-stone-200/60 flex items-center justify-center">
                    <Link href={`/viewer/${prod.id}`} className="block h-full w-full">
                      {prod.thumbnailUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={prod.thumbnailUrl}
                          alt={prod.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <Box className="h-8 w-8 text-stone-300" />
                      )}
                    </Link>
                    <span className="absolute top-1.5 left-1.5 rounded-full bg-white/95 px-2 py-0.5 text-[9px] font-bold text-indigo-700 shadow-2xs">
                      {prod.category}
                    </span>
                  </div>

                  <div className="flex flex-1 flex-col justify-between gap-1">
                    <div className="flex items-start justify-between gap-2">
                      <Link href={`/viewer/${prod.id}`}>
                        <h3 className="text-sm font-bold text-stone-900 group-hover:text-indigo-600 line-clamp-1">
                          {prod.name}
                        </h3>
                      </Link>
                    </div>

                    <div className="font-mono text-[11px] text-stone-500">
                      {formatDimension(prod.widthMm)} × {formatDimension(prod.depthMm)} × {formatDimension(prod.heightMm)}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 border-t border-stone-100 pt-2 sm:border-t-0 sm:pt-0">
                    <div className="text-base font-black text-stone-950">
                      {prod.priceBdt ? `৳${prod.priceBdt.toLocaleString("en-BD")}` : "Custom"}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Link
                        href={`/viewer/${prod.id}`}
                        className="inline-flex h-8.5 items-center justify-center gap-1 rounded-lg bg-gradient-brand px-3 text-[11px] font-bold text-white shadow-xs hover:opacity-95"
                      >
                        <Box className="h-3 w-3" />
                        <span>3D View</span>
                      </Link>

                      {productWaUrl && (
                        <a
                          href={productWaUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex h-8.5 items-center justify-center gap-1 rounded-lg bg-[#25D366] px-3 text-[11px] font-bold text-white shadow-xs hover:bg-[#20bd5a]"
                        >
                          <MessageCircle className="h-3 w-3 fill-white" />
                          <span>Order</span>
                        </a>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* 4. MINIMAL COMPACT FOOTER */}
      <footer className="mt-16 border-t border-stone-200/60 bg-white py-6 text-xs text-stone-500">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 text-center sm:flex-row sm:text-left lg:px-8">
          <p className="font-semibold text-stone-800">{storeName}</p>
          <p>
            Powered by{" "}
            <Link href="/" className="font-semibold text-indigo-600 hover:underline">
              Merchant 3D Shop
            </Link>
          </p>
        </div>
      </footer>
      {contactModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm"
        >
          <div className="glass-panel studio-card-shadow relative w-full max-w-lg rounded-3xl border border-white/80 bg-white p-6 shadow-2xl sm:p-8">
            <button
              type="button"
              onClick={() => setContactModalOpen(false)}
              className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-stone-100 text-stone-500 hover:bg-stone-200 hover:text-stone-900"
              aria-label="Close modal"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600">
                <Building2 className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-stone-950">{storeName}</h3>
                <p className="text-xs text-stone-500">Official Shop Contact & Direct Ordering</p>
              </div>
            </div>

            <div className="mt-6 space-y-4">
              <div className="rounded-2xl border border-stone-200/80 bg-stone-50/80 p-4 space-y-3 text-xs sm:text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-stone-500">Master Artisan:</span>
                  <span className="font-semibold text-stone-900">{profile.name || storeName}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-stone-500">Showroom Address:</span>
                  <span className="font-semibold text-stone-900">{profile.location || "Dhaka, Bangladesh"}</span>
                </div>

                {profile.whatsappNumber && (
                  <div className="flex items-center justify-between">
                    <span className="text-stone-500">WhatsApp / Direct:</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold text-indigo-700">{profile.whatsappNumber}</span>
                      <button
                        type="button"
                        onClick={() => handleCopyPhone(profile.whatsappNumber!)}
                        className="rounded px-2 py-0.5 text-[10px] font-semibold bg-stone-200 text-stone-800 hover:bg-stone-300"
                      >
                        {copiedPhone ? "Copied!" : "Copy"}
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <span className="text-stone-500">Visiting Hours:</span>
                  <span className="font-semibold text-stone-900">Sat – Thu, 10 AM – 8 PM (BST)</span>
                </div>
              </div>

              <div className="flex flex-col gap-2 pt-2 sm:flex-row">
                {merchantGeneralWaUrl && (
                  <a
                    href={merchantGeneralWaUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[#25D366] text-sm font-bold text-white shadow-md hover:bg-[#20bd5a]"
                  >
                    <MessageCircle className="h-4 w-4 fill-white text-white" />
                    <span>Open WhatsApp Chat</span>
                  </a>
                )}

                <Button
                  variant="outline"
                  onClick={() => setContactModalOpen(false)}
                  className="h-11 rounded-xl border-stone-300 text-sm font-medium hover:bg-stone-50"
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 8. QUICK VIEW VISUAL MODAL (Light Theme) */}
      {activePreviewProduct && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm"
        >
          <div className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-stone-200/90 bg-white shadow-2xl">
            <button
              type="button"
              onClick={() => setActivePreviewProduct(null)}
              className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-stone-200/80 bg-white/95 text-stone-600 hover:bg-white hover:text-stone-950 backdrop-blur-md shadow-sm"
              aria-label="Close preview"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="relative aspect-[16/10] w-full bg-stone-50 flex items-center justify-center border-b border-stone-200/60">
              {activePreviewProduct.thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={activePreviewProduct.thumbnailUrl}
                  alt={activePreviewProduct.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <Box className="h-16 w-16 text-stone-400" />
              )}

              <div className="absolute top-4 left-4">
                <Badge className="border border-stone-200/80 bg-white/95 text-xs font-bold text-indigo-700 shadow-md backdrop-blur-md">
                  {activePreviewProduct.category}
                </Badge>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <h3 className="text-xl font-bold text-stone-950">{activePreviewProduct.name}</h3>
                  {activePreviewProduct.description && (
                    <p className="text-xs text-stone-600 leading-relaxed">
                      {activePreviewProduct.description}
                    </p>
                  )}
                </div>
                <div className="text-2xl font-black text-stone-950 shrink-0">
                  {activePreviewProduct.priceBdt ? `৳${activePreviewProduct.priceBdt.toLocaleString("en-BD")}` : "Custom Quote"}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-xs font-mono text-stone-700 rounded-xl bg-stone-50 p-3 border border-stone-200/80">
                <Ruler className="h-4 w-4 text-indigo-600" />
                <span>
                  Dimensions: {formatDimension(activePreviewProduct.widthMm)} (W) × {formatDimension(activePreviewProduct.depthMm)} (D) × {formatDimension(activePreviewProduct.heightMm)} (H)
                </span>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <Link
                  href={`/viewer/${activePreviewProduct.id}`}
                  className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-brand text-xs font-bold text-white shadow-md shadow-indigo-500/20 hover:opacity-95"
                >
                  <Box className="h-4 w-4" />
                  <span>Launch Full 3D Inspector</span>
                </Link>

                <Button
                  variant="outline"
                  onClick={() => setActivePreviewProduct(null)}
                  className="h-11 rounded-xl border-stone-300 text-xs font-medium hover:bg-stone-50"
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
