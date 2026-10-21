"use client";

import React, { useState } from "react";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { X, ShieldCheck, LogOut, ArrowRightLeft } from "lucide-react";
import Link from "next/link";
import { LayoutDashboard, Box, PlusCircle, Coins, Settings } from "lucide-react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth/auth-context";

interface DashboardLayoutProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
}

export function DashboardLayout({ children, title, subtitle }: DashboardLayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const { user, role, isSaasAdmin, isCustomer, logout, switchDemoRole } = useAuth();

  const mobileNav = [
    { name: "Overview", href: "/", icon: LayoutDashboard, show: true },
    { name: "My Products", href: "/products", icon: Box, show: true },
    {
      name: "Create 3D Model",
      href: "/create",
      icon: PlusCircle,
      show: !isCustomer,
    },
    {
      name: "Credits & Usage",
      href: "/credits",
      icon: Coins,
      show: !isCustomer,
    },
    {
      name: "Admin RBAC",
      href: "/admin/rbac",
      icon: ShieldCheck,
      show: isSaasAdmin,
    },
    { name: "Settings", href: "/settings", icon: Settings, show: true },
  ];

  return (
    <div className="min-h-screen bg-[hsl(var(--background))] flex flex-col md:flex-row text-stone-900">
      {/* Desktop Sidebar */}
      <Sidebar />

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
                <span className="font-bold text-stone-900 font-display">
                  Artisan 3D
                </span>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1 rounded-lg text-stone-400 hover:text-stone-900"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Persona status in drawer */}
              <div className="mt-4 p-2.5 rounded-lg bg-stone-50 border border-stone-200/80 text-xs">
                <p className="font-bold text-stone-900 truncate">{user?.name || "User"}</p>
                <div className="flex items-center justify-between mt-1 text-[10px]">
                  <span className="text-stone-500">Role:</span>
                  <span className="font-bold uppercase tracking-wider text-amber-800">
                    {role.replace("_", " ")}
                  </span>
                </div>
              </div>

              <nav className="mt-4 space-y-1">
                {mobileNav
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
                        onClick={() => setMobileMenuOpen(false)}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors",
                          isActive
                            ? "bg-stone-100 text-stone-950 font-bold border border-stone-200/90 shadow-2xs"
                            : "text-stone-600 hover:bg-stone-50"
                        )}
                      >
                        <item.icon className="h-4 w-4" />
                        <span>{item.name}</span>
                      </Link>
                    );
                  })}
              </nav>
            </div>

            <div className="pt-4 border-t border-stone-100 space-y-2">
              <div className="grid grid-cols-3 gap-1 text-[9px] font-bold">
                <button
                  type="button"
                  onClick={() => switchDemoRole("saas_admin")}
                  className="py-1 rounded-sm border border-stone-200 bg-stone-50"
                >
                  Admin
                </button>
                <button
                  type="button"
                  onClick={() => switchDemoRole("merchant")}
                  className="py-1 rounded-sm border border-stone-200 bg-stone-50"
                >
                  Merch
                </button>
                <button
                  type="button"
                  onClick={() => switchDemoRole("customer")}
                  className="py-1 rounded-sm border border-stone-200 bg-stone-50"
                >
                  Cust
                </button>
              </div>
              <div className="flex items-center justify-between text-xs text-stone-500 pt-1">
                <Link href="/login" className="hover:text-stone-900 flex items-center gap-1">
                  <ArrowRightLeft className="h-3 w-3" />
                  <span>Login</span>
                </Link>
                <button onClick={logout} className="hover:text-rose-600 flex items-center gap-1">
                  <LogOut className="h-3 w-3" />
                  <span>Logout</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 md:pl-64 flex flex-col min-w-0">
        <Header
          title={title}
          subtitle={subtitle}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
        />

        <main className="flex-1 p-4 sm:p-8 max-w-7xl w-full mx-auto animate-in fade-in-50 duration-200">
          {children}
        </main>
      </div>
    </div>
  );
}
