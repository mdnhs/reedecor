import React from "react";
import Link from "next/link";
import { Layers, Sparkles, LogIn, ExternalLink, Box, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Artisan 3D — Public Storefront & 3D Furniture Catalog",
  description: "Browse interactive 1:1 scale 3D furniture models. Inspect materials, dimensions, and real proportions in real-time WebGL.",
};

export default function StoreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const currentYear = new Date().getFullYear();

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC] text-stone-900 font-sans antialiased selection:bg-indigo-100 selection:text-indigo-950">
      {/* 1. PUBLIC MARKETING TOPBAR */}
      <header className="sticky top-0 z-40 border-b border-stone-200/70 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Brand Logo & Name */}
          <div className="flex items-center gap-3">
            <Link
              href="/store"
              className="group flex items-center gap-2.5 transition-opacity hover:opacity-90"
            >
              <span className="bg-gradient-brand flex h-8 w-8 items-center justify-center rounded-xl text-white shadow-xs">
                <Layers className="h-4 w-4" />
              </span>
              <div className="flex items-center gap-2">
                <span className="font-display text-base font-bold tracking-tight text-stone-950">
                  Artisan 3D
                </span>
                <span className="hidden sm:inline-flex items-center gap-1 rounded-full border border-stone-200/80 bg-stone-50 px-2 py-0.5 text-[10px] font-semibold text-stone-600">
                  <Sparkles className="h-2.5 w-2.5 text-indigo-600" />
                  <span>Shop</span>
                </span>
              </div>
            </Link>
          </div>

          {/* Navigation & Merchant Portal Link */}
          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-1 text-xs text-stone-500 font-medium">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
              <span>1:1 Scale WebGL Models</span>
            </div>

            <div className="h-4 w-px bg-stone-200 hidden md:block" />

            <Link
              href="/login"
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 text-xs font-semibold text-stone-700 shadow-2xs hover:bg-stone-50 hover:text-stone-950 transition-colors"
            >
              <LogIn className="h-3.5 w-3.5 text-stone-500" />
              <span>Merchant Portal</span>
            </Link>
          </div>
        </div>
      </header>

      {/* 2. PUBLIC STORE CONTENT */}
      <main className="flex-1">
        {children}
      </main>

      {/* 3. PUBLIC MARKETING FOOTER */}
      <footer className="border-t border-stone-200/80 bg-white text-stone-600">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="bg-gradient-brand flex h-6 w-6 items-center justify-center rounded-lg text-white">
                  <Layers className="h-3 w-3" />
                </span>
                <span className="font-display text-sm font-bold tracking-tight text-stone-900">
                  Artisan 3D Storefront
                </span>
              </div>
              <p className="text-xs text-stone-500 max-w-md">
                Interactive 3D digital showroom for furniture merchants. Real dimensions, high-fidelity materials, and instant 3D inspection.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-stone-600">
              <Link href="/store" className="hover:text-stone-950 transition-colors">
                Public Catalog
              </Link>
              <Link href="/login" className="hover:text-stone-950 transition-colors">
                Merchant Sign In
              </Link>
              <span className="text-stone-300">•</span>
              <span className="text-stone-400">
                © {currentYear} Artisan 3D. All rights reserved.
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
