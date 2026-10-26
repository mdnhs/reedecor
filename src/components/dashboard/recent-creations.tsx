"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Box, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { StoredProduct } from "@/server/demo-store";
import { getProductThumbnail } from "@/lib/product-thumbnail";

const TABS = [
  { key: "all", label: "All" },
  { key: "completed", label: "Ready" },
  { key: "processing", label: "Processing" },
  { key: "draft", label: "Drafts" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

function timeAgo(iso: string) {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 60) return minutes <= 1 ? "Just now" : `${minutes} minutes ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function matchesTab(product: StoredProduct, tab: TabKey) {
  if (tab === "all") return true;
  if (tab === "processing") return product.status === "processing" || product.status === "queued";
  return product.status === tab;
}

export function RecentCreations({
  products,
  loading,
  className,
}: {
  products: StoredProduct[];
  loading: boolean;
  className?: string;
}) {
  const [tab, setTab] = useState<TabKey>("all");

  const items = [...products]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .filter((p) => matchesTab(p, tab))
    .slice(0, 6);

  return (
    <section className={cn("flex flex-col rounded-3xl bg-white/70 p-4", className)}>
      <div className="flex items-center justify-between px-1">
        <h2 className="font-display text-base font-bold">Recent Creations</h2>
        <Link href="/products" className="text-xs font-medium text-stone-500 hover:text-amber-700">
          View all
        </Link>
      </div>

      <div className="mt-3 flex flex-wrap gap-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium transition-colors",
              tab === t.key ? "bg-amber-600 text-white" : "text-stone-500 hover:bg-white hover:text-stone-900"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <ul className="mt-3 space-y-1">
        {loading &&
          [1, 2, 3, 4].map((i) => (
            <li key={i} className="flex items-center gap-3 p-2">
              <div className="h-14 w-14 animate-pulse rounded-2xl bg-stone-100" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-2/3 animate-pulse rounded-full bg-stone-100" />
                <div className="h-2.5 w-1/3 animate-pulse rounded-full bg-stone-100" />
              </div>
            </li>
          ))}

        {!loading && items.length === 0 && (
          <li className="py-8 text-center text-xs text-stone-400">Nothing here yet.</li>
        )}

        {!loading &&
          items.map((product) => {
            const thumbnail = getProductThumbnail(product);
            return (
              <li key={product.id}>
                <Link
                  href={`/viewer/${product.id}`}
                  className="group flex items-center gap-3 rounded-2xl p-2 hover:bg-white transition-colors"
                >
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-2xl bg-stone-100">
                    {thumbnail ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={thumbnail} alt={product.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-stone-300">
                        <Box className="h-5 w-5" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{product.name}</p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-xs text-stone-500">
                      <span>{timeAgo(product.updatedAt)}</span>
                      {product.status === "completed" && (
                        <span className="rounded-full bg-amber-50 px-1.5 text-amber-700">AI-generated 3D</span>
                      )}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-stone-300 group-hover:text-stone-600" />
                </Link>
              </li>
            );
          })}
      </ul>

      {!loading && items.length > 0 && (
        <Link
          href="/products"
          className="mt-auto flex items-center justify-center gap-1 rounded-2xl pt-3 text-xs font-medium text-stone-500 hover:text-amber-700"
        >
          Browse full catalog
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      )}
    </section>
  );
}
