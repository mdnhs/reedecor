"use client";

import Link from "next/link";
import { Coins, Plus, Menu, ShieldCheck, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth/auth-context";

interface HeaderProps {
  title?: string;
  subtitle?: string;
  onOpenMobileMenu?: () => void;
}

export function Header({ title = "Studio Overview", subtitle, onOpenMobileMenu }: HeaderProps) {
  const { role, isSaasAdmin, isCustomer, switchDemoRole } = useAuth();

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
        {/* Quick Role Switcher Pill */}
        <div className="hidden sm:flex items-center gap-1 bg-stone-100 p-0.5 rounded-lg border border-stone-200/80 text-[11px] font-semibold">
          <button
            onClick={() => switchDemoRole("saas_admin")}
            className={`px-2 py-1 rounded-md transition-all ${
              role === "saas_admin"
                ? "bg-amber-100 text-amber-900 shadow-2xs font-bold"
                : "text-stone-600 hover:text-stone-900"
            }`}
          >
            👑 SaaS Admin
          </button>
          <button
            onClick={() => switchDemoRole("merchant")}
            className={`px-2 py-1 rounded-md transition-all ${
              role === "merchant"
                ? "bg-emerald-100 text-emerald-900 shadow-2xs font-bold"
                : "text-stone-600 hover:text-stone-900"
            }`}
          >
            🏪 Merchant
          </button>
          <button
            onClick={() => switchDemoRole("customer")}
            className={`px-2 py-1 rounded-md transition-all ${
              role === "customer"
                ? "bg-white text-stone-900 shadow-2xs font-bold"
                : "text-stone-600 hover:text-stone-900"
            }`}
          >
            🛍️ Customer
          </button>
        </div>

        {/* Credits Badge (Hidden for Customer) */}
        {!isCustomer && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-amber-200/80 bg-amber-50/80 text-amber-900 text-xs font-semibold shadow-2xs">
            <Coins className="h-3.5 w-3.5 text-amber-600" />
            <span>80 Demo Credits</span>
          </div>
        )}

        {/* Customer Badge */}
        {isCustomer && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-stone-200 bg-stone-100 text-stone-800 text-xs font-semibold">
            <ShoppingBag className="h-3.5 w-3.5 text-stone-600" />
            <span>Storefront View</span>
          </div>
        )}

        {/* Primary Action Button */}
        {isSaasAdmin ? (
          <Link href="/admin/rbac">
            <Button size="sm" className="gap-1.5 bg-amber-700 hover:bg-amber-800 text-white shadow-xs">
              <ShieldCheck className="h-4 w-4" />
              <span className="hidden sm:inline">Admin RBAC</span>
            </Button>
          </Link>
        ) : !isCustomer ? (
          <Link href="/create">
            <Button size="sm" className="gap-1.5 bg-amber-700 hover:bg-amber-800 text-white shadow-xs">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Create 3D Model</span>
            </Button>
          </Link>
        ) : (
          <Link href="/products">
            <Button size="sm" variant="outline" className="gap-1.5 shadow-2xs">
              <span>Browse Catalog</span>
            </Button>
          </Link>
        )}
      </div>
    </header>
  );
}
