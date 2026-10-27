import React from "react";
import { Skeleton } from "@/components/ui/skeleton";

export function StorefrontSkeleton() {
  return (
    <div
      className="min-h-screen bg-[#F8FAFC] text-stone-900 font-sans"
      role="status"
      aria-busy="true"
      aria-label="Loading merchant shop"
    >
      <span className="sr-only">Loading merchant shop...</span>

      {/* 1. COMPACT MINIMAL HERO SKELETON */}
      <section className="border-b border-stone-200/60 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-5 sm:py-6 lg:px-8">
          {/* Top navigation row */}
          <div className="mb-3.5 flex items-center justify-between">
            <Skeleton className="h-5 w-36 rounded-full" />
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            {/* Identity */}
            <div className="flex items-center gap-3.5">
              <Skeleton className="h-14 w-14 sm:h-16 sm:w-16 rounded-2xl shrink-0" />

              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <Skeleton className="h-6 w-44 sm:w-56 rounded-md" />
                  <Skeleton className="h-4 w-4 rounded-full shrink-0" />
                </div>
                <Skeleton className="h-3.5 w-52 sm:w-72 rounded-md" />
                <div className="flex items-center gap-2 pt-0.5">
                  <Skeleton className="h-3 w-24 rounded-md" />
                  <Skeleton className="h-3 w-16 rounded-md" />
                  <Skeleton className="h-3 w-28 rounded-md" />
                </div>
              </div>
            </div>

            {/* Compact Action Buttons (Share, WhatsApp, Info) */}
            <div className="flex flex-wrap items-center gap-2 pt-1 sm:pt-0">
              <Skeleton className="h-9 w-20 rounded-xl" />
              <Skeleton className="h-9 w-24 rounded-xl" />
              <Skeleton className="h-9 w-9 rounded-xl" />
            </div>
          </div>
        </div>
      </section>

      {/* 2. COMPACT CATALOG TOOLBAR & PRODUCTS SKELETON */}
      <section className="mx-auto max-w-7xl px-4 py-6 lg:px-8 space-y-5">
        {/* Compact Filters & Controls Row */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Category Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            <Skeleton className="h-7 w-16 rounded-full" />
            <Skeleton className="h-7 w-20 rounded-full" />
            <Skeleton className="h-7 w-18 rounded-full" />
            <Skeleton className="h-7 w-20 rounded-full" />
          </div>

          {/* Search, Sort, View Controls */}
          <div className="flex items-center gap-2">
            <Skeleton className="h-8.5 w-44 sm:w-56 rounded-xl" />
            <Skeleton className="h-8.5 w-28 rounded-xl" />
            <Skeleton className="h-8.5 w-16 rounded-xl" />
          </div>
        </div>

        {/* 3. COMPACT PRODUCT GRID SKELETON */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="group relative flex flex-col overflow-hidden rounded-2xl border border-stone-200/80 bg-white shadow-2xs"
            >
              {/* Image Canvas Skeleton */}
              <div className="relative aspect-[4/3] w-full bg-stone-100 flex items-center justify-center p-3">
                <Skeleton className="h-full w-full rounded-xl" />

                {/* Floating pill skeletons */}
                <div className="absolute top-2.5 left-2.5">
                  <Skeleton className="h-5 w-14 rounded-full" />
                </div>
                <div className="absolute top-2.5 right-2.5">
                  <Skeleton className="h-7 w-7 rounded-full" />
                </div>
                <div className="absolute bottom-2.5 left-2.5">
                  <Skeleton className="h-5 w-10 rounded-full" />
                </div>
                <div className="absolute bottom-2.5 right-2.5">
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
              </div>

              {/* Card Body Skeleton */}
              <div className="p-3.5 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <Skeleton className="h-4 w-36 rounded-md" />
                  <Skeleton className="h-4 w-16 rounded-md" />
                </div>
                <div className="grid grid-cols-2 gap-1.5 pt-1 border-t border-stone-100">
                  <Skeleton className="h-8.5 rounded-lg" />
                  <Skeleton className="h-8.5 rounded-lg" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 4. MINIMAL FOOTER SKELETON */}
      <footer className="mt-16 border-t border-stone-200/60 bg-white py-6">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 sm:flex-row lg:px-8">
          <Skeleton className="h-4 w-32 rounded-md" />
          <Skeleton className="h-4 w-44 rounded-md" />
        </div>
      </footer>
    </div>
  );
}

export default StorefrontSkeleton;
