"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Box,
  PlusCircle,
  Coins,
  Settings,
  Sparkles,
  Layers,
  ChevronRight,
  ShieldCheck,
  LogOut,
  ArrowRightLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth/auth-context";

export function Sidebar() {
  const pathname = usePathname();
  const { user, role, isSaasAdmin, isCustomer, logout, switchDemoRole } = useAuth();

  const navigation = [
    { name: "Overview", href: "/", icon: LayoutDashboard, show: true },
    { name: "My Products", href: "/products", icon: Box, show: true },
    {
      name: "Create 3D Model",
      href: "/create",
      icon: PlusCircle,
      highlight: true,
      show: !isCustomer, // Hidden for customer
    },
    {
      name: "Credits & Usage",
      href: "/credits",
      icon: Coins,
      show: !isCustomer, // Hidden for customer
    },
    {
      name: "Admin RBAC",
      href: "/admin/rbac",
      icon: ShieldCheck,
      adminOnly: true,
      show: isSaasAdmin, // Only visible to SaaS Admin
    },
    { name: "Settings", href: "/settings", icon: Settings, show: true },
  ];

  return (
    <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 border-r border-stone-200/90 bg-white/95 backdrop-blur-md z-30">
      {/* Brand Header */}
      <div className="flex h-16 items-center px-6 border-b border-stone-200/80 justify-between">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-stone-900 text-white shadow-xs group-hover:bg-amber-800 transition-colors">
            <Layers className="h-4 w-4" />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-sm tracking-tight text-stone-900 font-display">
              Artisan 3D
            </span>
            <span className="text-[10px] font-semibold text-stone-400 uppercase tracking-widest">
              {isSaasAdmin ? "SaaS Admin Suite" : isCustomer ? "Customer Portal" : "Merchant Studio"}
            </span>
          </div>
        </Link>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 flex flex-col justify-between p-3 py-5">
        <nav className="space-y-1">
          {navigation
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
                  className={cn(
                    "group flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150",
                    isActive
                      ? "bg-stone-100 text-stone-950 font-bold border border-stone-200/90 shadow-2xs"
                      : "text-stone-600 hover:bg-stone-50 hover:text-stone-950",
                    item.highlight && !isActive && "text-amber-800 hover:bg-amber-50/60"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <item.icon
                      className={cn(
                        "h-4 w-4 shrink-0 transition-colors",
                        isActive
                          ? "text-amber-700"
                          : "text-stone-400 group-hover:text-stone-700",
                        item.highlight && !isActive && "text-amber-700"
                      )}
                    />
                    <span>{item.name}</span>
                  </div>
                  {item.highlight ? (
                    <Sparkles
                      className={cn(
                        "h-3.5 w-3.5",
                        isActive ? "text-amber-600" : "text-amber-500"
                      )}
                    />
                  ) : item.adminOnly ? (
                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-sm bg-amber-100 text-amber-900 border border-amber-200">
                      RBAC
                    </span>
                  ) : (
                    isActive && (
                      <ChevronRight className="h-3.5 w-3.5 text-stone-400" />
                    )
                  )}
                </Link>
              );
            })}
        </nav>

        {/* User Persona & Role Card */}
        <div className="space-y-2 pt-4 border-t border-stone-100">
          <div className="p-3 rounded-xl border border-stone-200/80 bg-stone-50/70 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={`h-7 w-7 rounded-full flex items-center justify-center font-bold text-xs ${
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
                    {user?.name || "User"}
                  </p>
                  <p className="text-[10px] text-stone-500 font-mono truncate">
                    {user?.email || "user@artisanstudio.com"}
                  </p>
                </div>
              </div>
            </div>

            {/* Role indicator badge */}
            <div className="flex items-center justify-between pt-1 border-t border-stone-200/60 text-[10px]">
              <span className="text-stone-500 font-medium">Active Role:</span>
              <span
                className={`font-bold px-1.5 py-0.5 rounded-sm capitalize ${
                  role === "saas_admin"
                    ? "bg-amber-100 text-amber-900 border border-amber-200"
                    : role === "merchant"
                    ? "bg-emerald-100 text-emerald-900 border border-emerald-200"
                    : "bg-stone-200 text-stone-800"
                }`}
              >
                {role.replace("_", " ")}
              </span>
            </div>

            {/* Quick 1-Click Role Switcher */}
            <div className="grid grid-cols-3 gap-1 pt-1 text-[9px] font-bold">
              <button
                type="button"
                onClick={() => switchDemoRole("saas_admin")}
                title="Switch to SaaS Admin"
                className={`py-1 px-1 rounded-sm text-center border transition-colors ${
                  role === "saas_admin"
                    ? "bg-amber-100 border-amber-300 text-amber-900 shadow-2xs"
                    : "bg-white border-stone-200 text-stone-600 hover:bg-stone-100"
                }`}
              >
                👑 Admin
              </button>
              <button
                type="button"
                onClick={() => switchDemoRole("merchant")}
                title="Switch to Merchant"
                className={`py-1 px-1 rounded-sm text-center border transition-colors ${
                  role === "merchant"
                    ? "bg-emerald-100 border-emerald-300 text-emerald-900 shadow-2xs"
                    : "bg-white border-stone-200 text-stone-600 hover:bg-stone-100"
                }`}
              >
                🏪 Merch
              </button>
              <button
                type="button"
                onClick={() => switchDemoRole("customer")}
                title="Switch to Customer"
                className={`py-1 px-1 rounded-sm text-center border transition-colors ${
                  role === "customer"
                    ? "bg-stone-200 border-stone-400 text-stone-900 shadow-2xs"
                    : "bg-white border-stone-200 text-stone-600 hover:bg-stone-100"
                }`}
              >
                🛍️ Cust
              </button>
            </div>
          </div>

          {/* Action Row */}
          <div className="flex items-center justify-between px-1 text-xs text-stone-500">
            <Link
              href="/login"
              className="hover:text-stone-900 flex items-center gap-1 font-medium transition-colors"
            >
              <ArrowRightLeft className="h-3 w-3" />
              <span>Login Page</span>
            </Link>
            <button
              onClick={logout}
              className="hover:text-rose-600 flex items-center gap-1 font-medium transition-colors"
            >
              <LogOut className="h-3 w-3" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
