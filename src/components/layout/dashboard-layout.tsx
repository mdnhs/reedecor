"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
  ChevronRight,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth/auth-context";
import { Button } from "@/components/ui/button";

interface DashboardLayoutProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
}

export function DashboardLayout({ children, title = "Dashboard", subtitle }: DashboardLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const { user, role, isSaasAdmin, isCustomer, logout, switchDemoRole } = useAuth();

  const navPlatform = [
    { name: "Overview", href: "/", icon: LayoutDashboard, show: true },
    { name: "My Products", href: "/products", icon: Box, show: true },
    {
      name: "Create 3D Model",
      href: "/create",
      icon: PlusCircle,
      highlight: true,
      show: !isCustomer,
    },
    {
      name: "Credits & Usage",
      href: "/credits",
      icon: Coins,
      show: !isCustomer,
    },
  ];

  const navAdmin = [
    {
      name: "Admin RBAC",
      href: "/admin/rbac",
      icon: ShieldCheck,
      adminOnly: true,
      show: isSaasAdmin,
    },
  ];

  const navSettings = [
    { name: "Settings", href: "/settings", icon: Settings, show: true },
  ];

  return (
    <div className="min-h-screen w-full bg-stone-100/80 flex text-stone-900 antialiased font-sans">
      {/* ----------------------------------------------------------------- */}
      {/* 1. AppSidebar (shadcn dashboard-01 Inset Style)                   */}
      {/* ----------------------------------------------------------------- */}
      <aside
        className={cn(
          "hidden md:flex flex-col justify-between shrink-0 transition-all duration-200 ease-in-out py-3 pl-3",
          sidebarCollapsed ? "w-18" : "w-64"
        )}
      >
        <div className="flex flex-col space-y-4">
          {/* Sidebar Brand Header */}
          <div className="flex h-12 items-center px-3 justify-between">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-stone-900 text-stone-50 shadow-xs group-hover:bg-amber-800 transition-colors">
                <Layers className="h-4.5 w-4.5 text-amber-400" />
              </div>
              {!sidebarCollapsed && (
                <div className="flex flex-col min-w-0">
                  <span className="font-bold text-sm tracking-tight text-stone-900 font-display truncate">
                    Artisan 3D
                  </span>
                  <span className="text-[10px] font-semibold text-stone-500 uppercase tracking-widest truncate">
                    {isSaasAdmin
                      ? "SaaS Admin"
                      : isCustomer
                      ? "Customer Portal"
                      : "Merchant Studio"}
                  </span>
                </div>
              )}
            </Link>
          </div>

          {/* Navigation Groups */}
          <div className="space-y-4 px-1">
            {/* Group 1: Platform */}
            <div className="space-y-1">
              {!sidebarCollapsed && (
                <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-stone-400">
                  Platform
                </p>
              )}
              {navPlatform
                .filter((item) => item.show)
                .map((item) => {
                  const isActive =
                    item.href === "/"
                      ? pathname === "/"
                      : pathname?.startsWith(item.href);

                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      title={sidebarCollapsed ? item.name : undefined}
                      className={cn(
                        "group flex items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold transition-all",
                        isActive
                          ? "bg-white text-stone-900 shadow-2xs border border-stone-200/90 font-bold"
                          : "text-stone-600 hover:bg-white/60 hover:text-stone-900",
                        sidebarCollapsed && "justify-center px-2"
                      )}
                    >
                      <div className="flex items-center gap-2.5">
                        <item.icon
                          className={cn(
                            "h-4 w-4 shrink-0 transition-colors",
                            isActive
                              ? "text-amber-700"
                              : "text-stone-400 group-hover:text-stone-700",
                            item.highlight && !isActive && "text-amber-700"
                          )}
                        />
                        {!sidebarCollapsed && <span>{item.name}</span>}
                      </div>
                      {!sidebarCollapsed && item.highlight && (
                        <Sparkles className="h-3.5 w-3.5 text-amber-600" />
                      )}
                      {!sidebarCollapsed && !item.highlight && isActive && (
                        <ChevronRight className="h-3.5 w-3.5 text-stone-400" />
                      )}
                    </Link>
                  );
                })}
            </div>

            {/* Group 2: Administration (if Admin) */}
            {isSaasAdmin && (
              <div className="space-y-1 pt-1">
                {!sidebarCollapsed && (
                  <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-stone-400">
                    Administration
                  </p>
                )}
                {navAdmin.map((item) => {
                  const isActive = pathname?.startsWith(item.href);
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      title={sidebarCollapsed ? item.name : undefined}
                      className={cn(
                        "group flex items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold transition-all",
                        isActive
                          ? "bg-white text-stone-900 shadow-2xs border border-stone-200/90 font-bold"
                          : "text-stone-600 hover:bg-white/60 hover:text-stone-900",
                        sidebarCollapsed && "justify-center px-2"
                      )}
                    >
                      <div className="flex items-center gap-2.5">
                        <item.icon
                          className={cn(
                            "h-4 w-4 shrink-0 transition-colors",
                            isActive ? "text-amber-700" : "text-stone-400 group-hover:text-stone-700"
                          )}
                        />
                        {!sidebarCollapsed && <span>{item.name}</span>}
                      </div>
                      {!sidebarCollapsed && (
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-sm bg-amber-100 text-amber-900 border border-amber-200">
                          RBAC
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            )}

            {/* Group 3: Settings */}
            <div className="space-y-1 pt-1">
              {!sidebarCollapsed && (
                <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-stone-400">
                  Preferences
                </p>
              )}
              {navSettings.map((item) => {
                const isActive = pathname?.startsWith(item.href);
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    title={sidebarCollapsed ? item.name : undefined}
                    className={cn(
                      "group flex items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold transition-all",
                      isActive
                        ? "bg-white text-stone-900 shadow-2xs border border-stone-200/90 font-bold"
                        : "text-stone-600 hover:bg-white/60 hover:text-stone-900",
                      sidebarCollapsed && "justify-center px-2"
                    )}
                  >
                    <div className="flex items-center gap-2.5">
                      <item.icon
                        className={cn(
                          "h-4 w-4 shrink-0 transition-colors",
                          isActive ? "text-amber-700" : "text-stone-400 group-hover:text-stone-700"
                        )}
                      />
                      {!sidebarCollapsed && <span>{item.name}</span>}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>

        {/* Sidebar Footer User Card */}
        <div className="p-1 space-y-2">
          {!sidebarCollapsed ? (
            <div className="p-3 rounded-2xl bg-white/80 border border-stone-200/90 shadow-2xs space-y-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={`h-8 w-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                    role === "saas_admin"
                      ? "bg-amber-100 text-amber-900 border border-amber-300"
                      : role === "merchant"
                      ? "bg-stone-900 text-stone-50"
                      : "bg-stone-200 text-stone-700"
                  }`}
                >
                  {user?.name ? user.name.slice(0, 2).toUpperCase() : "U"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-stone-900 truncate">
                    {user?.name || "Merchant"}
                  </p>
                  <p className="text-[10px] text-stone-500 font-mono truncate">
                    {user?.email || "demo@artisan.studio"}
                  </p>
                </div>
              </div>

              {/* Quick Persona Pills */}
              <div className="grid grid-cols-3 gap-1 pt-1.5 border-t border-stone-100 text-[9px] font-bold">
                <button
                  type="button"
                  onClick={() => switchDemoRole("saas_admin")}
                  className={`py-1 rounded-sm border transition-colors ${
                    role === "saas_admin"
                      ? "bg-amber-100 border-amber-300 text-amber-900"
                      : "bg-white border-stone-200 text-stone-600 hover:bg-stone-50"
                  }`}
                >
                  Admin
                </button>
                <button
                  type="button"
                  onClick={() => switchDemoRole("merchant")}
                  className={`py-1 rounded-sm border transition-colors ${
                    role === "merchant"
                      ? "bg-emerald-100 border-emerald-300 text-emerald-900"
                      : "bg-white border-stone-200 text-stone-600 hover:bg-stone-50"
                  }`}
                >
                  Merch
                </button>
                <button
                  type="button"
                  onClick={() => switchDemoRole("customer")}
                  className={`py-1 rounded-sm border transition-colors ${
                    role === "customer"
                      ? "bg-stone-200 border-stone-400 text-stone-900"
                      : "bg-white border-stone-200 text-stone-600 hover:bg-stone-50"
                  }`}
                >
                  Cust
                </button>
              </div>

              <button
                onClick={logout}
                className="w-full pt-1 text-[11px] text-stone-500 hover:text-rose-600 font-medium flex items-center justify-center gap-1.5 transition-colors"
              >
                <LogOut className="h-3 w-3" />
                <span>Sign Out</span>
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <button
                onClick={logout}
                title="Sign Out"
                className="p-2 rounded-xl text-stone-400 hover:text-rose-600 hover:bg-white"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div
            className="fixed inset-0 bg-stone-900/40 backdrop-blur-xs"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative w-64 bg-white p-6 flex flex-col justify-between shadow-2xl">
            <div>
              <div className="flex items-center justify-between pb-6 border-b border-stone-100">
                <span className="font-bold text-stone-900 font-display">Artisan 3D</span>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1 rounded-lg text-stone-400 hover:text-stone-900"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="mt-4 p-2.5 rounded-lg bg-stone-50 border border-stone-200/80 text-xs">
                <p className="font-bold text-stone-900 truncate">{user?.name || "User"}</p>
                <p className="text-[10px] text-amber-800 font-bold uppercase tracking-wider">
                  {role.replace("_", " ")}
                </p>
              </div>

              <nav className="mt-4 space-y-1">
                {[...navPlatform, ...navAdmin, ...navSettings]
                  .filter((item) => item.show)
                  .map((item) => (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors",
                        pathname === item.href
                          ? "bg-stone-100 text-stone-950 font-bold border border-stone-200/90"
                          : "text-stone-600 hover:bg-stone-50"
                      )}
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.name}</span>
                    </Link>
                  ))}
              </nav>
            </div>

            <div className="pt-4 border-t border-stone-100 flex items-center justify-between text-xs text-stone-500">
              <button onClick={logout} className="hover:text-rose-600 flex items-center gap-1">
                <LogOut className="h-3 w-3" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* 2. SidebarInset: Floating Inset Rounded Container (shadcn 01)     */}
      {/* ----------------------------------------------------------------- */}
      <div className="flex-1 flex flex-col min-w-0 my-2 sm:my-3 mr-2 sm:mr-3 ml-2 md:ml-0 rounded-2xl bg-white border border-stone-200/90 shadow-xs overflow-hidden">
        {/* SiteHeader inside Inset Container */}
        <header className="h-14 shrink-0 border-b border-stone-200/80 px-4 sm:px-6 flex items-center justify-between bg-white/95 backdrop-blur-md sticky top-0 z-20">
          <div className="flex items-center gap-2">
            {/* Desktop Sidebar Collapse Button */}
            <button
              onClick={() => setSidebarCollapsed((c) => !c)}
              className="hidden md:flex h-8 w-8 items-center justify-center rounded-lg text-stone-500 hover:bg-stone-100 hover:text-stone-900 transition-colors"
              title="Toggle Sidebar"
            >
              <PanelLeft className="h-4 w-4" />
            </button>

            {/* Mobile Menu Trigger */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden flex h-8 w-8 items-center justify-center rounded-lg text-stone-500 hover:bg-stone-100 hover:text-stone-900"
            >
              <Menu className="h-4.5 w-4.5" />
            </button>

            {/* Vertical Separator */}
            <div className="h-4 w-px bg-stone-200 mx-1 hidden sm:block" />

            {/* Breadcrumb Trail */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-stone-400 font-medium">Artisan 3D</span>
              <span className="text-stone-300">/</span>
              <span className="font-bold text-stone-900">{title}</span>
              {subtitle && (
                <span className="hidden xl:inline text-stone-400 font-normal">
                  — {subtitle}
                </span>
              )}
            </div>
          </div>

          {/* Right Header Actions */}
          <div className="flex items-center gap-2.5">
            {/* Role indicator pill */}
            <div className="hidden sm:flex items-center gap-1 bg-stone-100 p-0.5 rounded-lg border border-stone-200/80 text-[10px] font-semibold">
              <button
                onClick={() => switchDemoRole("saas_admin")}
                className={cn(
                  "px-2 py-0.5 rounded-md transition-all",
                  role === "saas_admin"
                    ? "bg-amber-100 text-amber-900 shadow-2xs font-bold"
                    : "text-stone-500 hover:text-stone-900"
                )}
              >
                👑 Admin
              </button>
              <button
                onClick={() => switchDemoRole("merchant")}
                className={cn(
                  "px-2 py-0.5 rounded-md transition-all",
                  role === "merchant"
                    ? "bg-emerald-100 text-emerald-900 shadow-2xs font-bold"
                    : "text-stone-500 hover:text-stone-900"
                )}
              >
                🏪 Merch
              </button>
              <button
                onClick={() => switchDemoRole("customer")}
                className={cn(
                  "px-2 py-0.5 rounded-md transition-all",
                  role === "customer"
                    ? "bg-white text-stone-900 shadow-2xs font-bold"
                    : "text-stone-500 hover:text-stone-900"
                )}
              >
                🛍️ Cust
              </button>
            </div>

            {/* Header Action Button */}
            {isSaasAdmin ? (
              <Link href="/admin/rbac">
                <Button size="sm" className="h-8 gap-1.5 text-xs bg-amber-700 hover:bg-amber-800 text-white shadow-xs">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Admin RBAC</span>
                </Button>
              </Link>
            ) : !isCustomer ? (
              <Link href="/create">
                <Button size="sm" className="h-8 gap-1.5 text-xs bg-amber-700 hover:bg-amber-800 text-white shadow-xs">
                  <Plus className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Create 3D</span>
                </Button>
              </Link>
            ) : null}
          </div>
        </header>

        {/* Main Inner Content Body */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
