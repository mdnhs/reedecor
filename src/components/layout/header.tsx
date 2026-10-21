"use client";

import Link from "next/link";
import { Coins, Plus, Menu } from "lucide-react";
import { Button } from "@/lib/../components/ui/button";

interface HeaderProps {
  title?: string;
  subtitle?: string;
  onOpenMobileMenu?: () => void;
}

export function Header({ title = "Studio Overview", subtitle, onOpenMobileMenu }: HeaderProps) {
  return (
    <header className="sticky top-0 z-20 flex h-16 w-full items-center justify-between border-b border-stone-200/80 bg-white/80 px-4 sm:px-8 backdrop-blur-md dark:border-stone-800 dark:bg-stone-900/80">
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobileMenu}
          className="md:hidden p-2 text-stone-600 hover:text-stone-900 dark:text-stone-400"
          aria-label="Open navigation menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-base sm:text-lg font-semibold tracking-tight text-stone-900 dark:text-stone-100">
            {title}
          </h1>
          {subtitle && (
            <p className="hidden sm:block text-xs text-stone-500 dark:text-stone-400">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Demo Credits Badge */}
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-amber-200 bg-amber-50/70 text-amber-900 text-xs font-medium dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300">
          <Coins className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
          <span>80 Demo Credits</span>
        </div>

        {/* Create 3D Model Primary Action */}
        <Link href="/create">
          <Button size="sm" variant="default" className="gap-1.5">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Create 3D Model</span>
          </Button>
        </Link>
      </div>
    </header>
  );
}
