"use client";

import Link from "next/link";
import { Coins, Plus, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";

interface HeaderProps {
  title?: string;
  subtitle?: string;
  onOpenMobileMenu?: () => void;
}

export function Header({ title = "Studio Overview", subtitle, onOpenMobileMenu }: HeaderProps) {
  return (
    <header className="sticky top-0 z-20 flex h-16 w-full items-center justify-between border-b border-stone-200/80 bg-white/90 px-4 sm:px-8 backdrop-blur-md">
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobileMenu}
          className="md:hidden p-2 rounded-lg text-stone-600 hover:bg-stone-100 hover:text-stone-900"
          aria-label="Open navigation menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-base sm:text-lg font-bold tracking-tight text-stone-900 font-display">
            {title}
          </h1>
          {subtitle && (
            <p className="hidden sm:block text-xs text-stone-500 font-normal">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Credits Badge */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-amber-200/80 bg-amber-50/80 text-amber-900 text-xs font-semibold shadow-2xs">
          <Coins className="h-3.5 w-3.5 text-amber-600" />
          <span>80 Demo Credits</span>
        </div>

        {/* Primary Create Action */}
        <Link href="/create">
          <Button size="sm" className="gap-1.5 bg-stone-900 hover:bg-stone-800 text-white shadow-xs">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Create 3D Model</span>
          </Button>
        </Link>
      </div>
    </header>
  );
}
