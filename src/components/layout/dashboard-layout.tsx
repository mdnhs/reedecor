"use client";

import React, { useState } from "react";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { X } from "lucide-react";
import Link from "next/link";
import { LayoutDashboard, Box, PlusCircle, Coins, Settings } from "lucide-react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface DashboardLayoutProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
}

export function DashboardLayout({ children, title, subtitle }: DashboardLayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  const mobileNav = [
    { name: "Overview", href: "/", icon: LayoutDashboard },
    { name: "My Products", href: "/products", icon: Box },
    { name: "Create 3D Model", href: "/create", icon: PlusCircle },
    { name: "Credits & Usage", href: "/credits", icon: Coins },
    { name: "Settings", href: "/settings", icon: Settings },
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
              <nav className="mt-6 space-y-1">
                {mobileNav.map((item) => {
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
                          ? "bg-stone-900 text-white font-semibold shadow-xs"
                          : "text-stone-600 hover:bg-stone-100"
                      )}
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.name}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>
            <div className="pt-6 border-t border-stone-100 text-xs text-stone-500 font-medium">
              Demo Merchant Mode • Supabase Live
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
