"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Box,
  PlusCircle,
  Coins,
  Settings,
  ShieldCheck,
  PanelLeft,
  Plus,
  Layers,
  Sparkles,
  LogOut,
  Menu,
  X,
  Store,
  Shapes,
  ToggleRight,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth/auth-context";
import type { UserRole } from "@/lib/supabase/auth-service";
import { useFeature } from "@/lib/features/features-context";
import { isPublicPath } from "@/lib/auth/route-guard";

interface DashboardLayoutProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
}

interface NavItem {
  name: string;
  href: string;
  icon: LucideIcon;
  show: boolean;
  highlight?: boolean;
  badge?: string;
}

const ROLE_OPTIONS: { role: UserRole; label: string }[] = [
  { role: "saas_admin", label: "Admin" },
  { role: "merchant", label: "Merchant" },
  { role: "customer", label: "Customer" },
];

function isActivePath(pathname: string | null, href: string) {
  return href === "/" ? pathname === "/" : !!pathname?.startsWith(href);
}

function NavLink({
  item,
  active,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      title={collapsed ? item.name : undefined}
      className={cn(
        "group flex items-center justify-between rounded-2xl px-3 py-2.5 text-sm font-medium transition-all",
        active
          ? "bg-white text-stone-900 shadow-sm shadow-amber-900/5"
          : "text-stone-600 hover:bg-white/60 hover:text-stone-900",
        collapsed && "justify-center px-2"
      )}
    >
      <span className="flex items-center gap-3">
        <item.icon
          className={cn(
            "h-4.5 w-4.5 shrink-0 transition-colors",
            active || item.highlight ? "text-amber-700" : "text-stone-400 group-hover:text-stone-700"
          )}
        />
        {!collapsed && <span>{item.name}</span>}
      </span>
      {!collapsed && item.highlight && <Sparkles className="h-3.5 w-3.5 text-amber-500" />}
      {!collapsed && item.badge && (
        <span className="rounded-full bg-amber-600 px-2 py-0.5 text-xs font-semibold text-white">
          {item.badge}
        </span>
      )}
    </Link>
  );
}

export function DashboardLayout({ children, title = "Dashboard", subtitle }: DashboardLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { user, role, isLoading, isSaasAdmin, isCustomer, demoMode, logout, switchDemoRole } = useAuth();
  const generationOn = useFeature("model_generation");

  const merchantStoreId = user?.id || "demo-merchant-001";
  const canCreate = !isCustomer && generationOn;

  const navGroups: { label: string; items: NavItem[] }[] = [
    {
      label: "Platform",
      items: [
        { name: "Overview", href: "/", icon: LayoutDashboard, show: true },
        { name: "My Products", href: "/products", icon: Box, show: true },
        { name: "Public Store", href: `/store/${merchantStoreId}`, icon: Store, show: true },
        { name: "Create 3D Model", href: "/create", icon: PlusCircle, highlight: true, show: canCreate },
        { name: "Credits & Usage", href: "/credits", icon: Coins, show: !isCustomer },
      ],
    },
    {
      label: "Administration",
      items: [
        { name: "Admin RBAC", href: "/admin/rbac", icon: ShieldCheck, show: isSaasAdmin, badge: "RBAC" },
        { name: "Room Assets", href: "/admin/assets", icon: Shapes, show: isSaasAdmin },
        { name: "Features", href: "/admin/features", icon: ToggleRight, show: isSaasAdmin },
      ],
    },
    {
      label: "Preferences",
      items: [{ name: "Settings", href: "/settings", icon: Settings, show: true }],
    },
  ]
    .map((group) => ({ ...group, items: group.items.filter((item) => item.show) }))
    .filter((group) => group.items.length > 0);

  const initials = user?.name ? user.name.slice(0, 2).toUpperCase() : "U";

  useEffect(() => {
    if (!isLoading && !user && !isPublicPath(pathname || "/")) {
      router.replace(`/login?next=${encodeURIComponent(pathname || "/")}`);
    }
  }, [isLoading, user, router, pathname]);

  return (
    <div className="h-screen w-full flex gap-3 p-2 sm:p-3 text-stone-900 antialiased font-sans overflow-hidden">
      <aside
        className={cn(
          "glass-panel hidden md:flex flex-col justify-between shrink-0 rounded-3xl p-3 transition-all duration-200 ease-in-out",
          sidebarCollapsed ? "w-20" : "w-64"
        )}
      >
        <div className="flex min-h-0 flex-col gap-5 overflow-y-auto">
          <div className={cn("flex items-center px-2 pt-1", sidebarCollapsed && "justify-center")}>
            <Link href="/" className="flex items-center gap-2.5 min-w-0">
              <span className="bg-gradient-brand flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white shadow-md shadow-amber-700/30">
                <Layers className="h-4.5 w-4.5" />
              </span>
              {!sidebarCollapsed && (
                <span className="font-display text-lg font-bold tracking-tight truncate">Artisan 3D</span>
              )}
            </Link>
          </div>

          <nav className="space-y-4">
            {navGroups.map((group) => (
              <div key={group.label} className="space-y-1">
                {!sidebarCollapsed && (
                  <p className="px-3 pb-1 text-xs font-medium text-stone-400">{group.label}</p>
                )}
                {group.items.map((item) => (
                  <NavLink
                    key={item.name}
                    item={item}
                    active={isActivePath(pathname, item.href)}
                    collapsed={sidebarCollapsed}
                  />
                ))}
              </div>
            ))}
          </nav>
        </div>

        <div className="space-y-3 pt-3">
          {!sidebarCollapsed && canCreate && (
            <div className="relative overflow-hidden rounded-2xl border border-white bg-linear-to-br from-sky-100 via-amber-100 to-pink-100 p-4">
              <div className="bg-gradient-brand absolute -right-6 -top-6 h-20 w-20 rotate-12 rounded-3xl opacity-30 blur-sm" />
              <p className="relative font-display text-sm font-bold leading-snug">Turn photos into 3D</p>
              <p className="relative mt-1 text-xs text-stone-600">
                Upload product angles and get an AI-generated GLB model.
              </p>
              <Link
                href="/create"
                className="relative mt-3 inline-flex items-center gap-1.5 rounded-full bg-stone-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-stone-800 transition-colors"
              >
                Start creating
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          )}

          {!sidebarCollapsed ? (
            <div className="space-y-2.5 rounded-2xl bg-white/70 p-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="bg-gradient-brand flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white">
                  {initials}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{user?.name || "Merchant"}</p>
                  <p className="text-xs text-stone-500 truncate">{user?.email || "demo@artisan.studio"}</p>
                </div>
                <button
                  onClick={logout}
                  title="Sign out"
                  aria-label="Sign out"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-stone-400 hover:bg-white hover:text-rose-600 transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <span className="bg-gradient-brand flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-white">
                {initials}
              </span>
              <button
                onClick={logout}
                title="Sign out"
                aria-label="Sign out"
                className="p-2 rounded-xl text-stone-400 hover:text-rose-600 hover:bg-white"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </aside>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div
            className="fixed inset-0 bg-stone-900/30 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative m-2 w-72 rounded-3xl bg-white/95 p-4 flex flex-col justify-between shadow-2xl">
            <div className="space-y-4 overflow-y-auto">
              <div className="flex items-center justify-between px-2">
                <span className="flex items-center gap-2.5">
                  <span className="bg-gradient-brand flex h-9 w-9 items-center justify-center rounded-xl text-white">
                    <Layers className="h-4.5 w-4.5" />
                  </span>
                  <span className="font-display text-lg font-bold">Artisan 3D</span>
                </span>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  aria-label="Close menu"
                  className="p-1.5 rounded-xl text-stone-400 hover:text-stone-900"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <nav className="space-y-1">
                {navGroups.flatMap((group) => group.items).map((item) => (
                  <NavLink
                    key={item.name}
                    item={item}
                    active={isActivePath(pathname, item.href)}
                    onNavigate={() => setMobileMenuOpen(false)}
                  />
                ))}
              </nav>
            </div>

            <div className="flex items-center justify-between rounded-2xl bg-stone-50 p-3 text-sm">
              <div className="min-w-0">
                <p className="font-semibold truncate">{user?.name || "User"}</p>
                <p className="text-xs text-amber-700 capitalize">{role.replace("_", " ")}</p>
              </div>
              <button onClick={logout} className="flex items-center gap-1 text-xs text-stone-500 hover:text-rose-600">
                <LogOut className="h-3.5 w-3.5" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="glass-panel flex-1 flex flex-col min-w-0 rounded-3xl overflow-hidden">
        <header className="h-16 shrink-0 px-4 sm:px-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open menu"
              className="md:hidden flex h-9 w-9 items-center justify-center rounded-xl bg-white/70 text-stone-600 hover:text-stone-900"
            >
              <Menu className="h-4.5 w-4.5" />
            </button>
            <button
              onClick={() => setSidebarCollapsed((c) => !c)}
              title="Toggle sidebar"
              aria-label="Toggle sidebar"
              className="hidden md:flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/70 text-stone-500 hover:bg-white hover:text-stone-900 transition-colors"
            >
              <PanelLeft className="h-4 w-4" />
            </button>
            <div className="min-w-0">
              <h1 className="font-display text-base sm:text-lg font-bold tracking-tight truncate">{title}</h1>
              {subtitle && <p className="hidden lg:block text-xs text-stone-500 truncate">{subtitle}</p>}
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {demoMode && (
            <div className="hidden sm:flex items-center gap-0.5 rounded-full bg-white/70 p-1 text-xs font-medium">
              {ROLE_OPTIONS.map((option) => (
                <button
                  key={option.role}
                  onClick={() => switchDemoRole(option.role)}
                  className={cn(
                    "rounded-full px-3 py-1 transition-all",
                    role === option.role
                      ? "bg-amber-50 text-amber-800 shadow-xs font-semibold"
                      : "text-stone-500 hover:text-stone-900"
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
            )}

            {isSaasAdmin ? (
              <Link
                href="/admin/rbac"
                className="bg-gradient-brand inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-xs font-semibold text-white shadow-md shadow-amber-700/25 hover:opacity-90 transition-opacity"
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Admin RBAC</span>
              </Link>
            ) : canCreate ? (
              <Link
                href="/create"
                className="bg-gradient-brand inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-xs font-semibold text-white shadow-md shadow-amber-700/25 hover:opacity-90 transition-opacity"
              >
                <Plus className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Create 3D</span>
              </Link>
            ) : null}
          </div>
        </header>

        <main className="flex-1 px-4 pb-4 sm:px-6 sm:pb-6 lg:px-8 lg:pb-8 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
