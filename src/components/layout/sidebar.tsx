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
  Database,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DEMO_MERCHANT } from "@/lib/constants";

const navigation = [
  { name: "Overview", href: "/", icon: LayoutDashboard },
  { name: "My Products", href: "/products", icon: Box },
  { name: "Create 3D Model", href: "/create", icon: PlusCircle, highlight: true },
  { name: "Credits & Usage", href: "/credits", icon: Coins },
  { name: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

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
              Merchant Studio
            </span>
          </div>
        </Link>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 flex flex-col justify-between p-3 py-5">
        <nav className="space-y-1">
          {navigation.map((item) => {
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
                    ? "bg-stone-900 text-white shadow-xs font-semibold"
                    : "text-stone-600 hover:bg-stone-100 hover:text-stone-950",
                  item.highlight && !isActive && "text-amber-800 hover:bg-amber-50"
                )}
              >
                <div className="flex items-center gap-3">
                  <item.icon
                    className={cn(
                      "h-4 w-4 shrink-0 transition-colors",
                      isActive
                        ? "text-white"
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
                      isActive ? "text-amber-400" : "text-amber-600"
                    )}
                  />
                ) : (
                  isActive && (
                    <ChevronRight className="h-3.5 w-3.5 text-stone-400" />
                  )
                )}
              </Link>
            );
          })}
        </nav>

        {/* Demo Merchant Profile Card */}
        <div className="space-y-3 pt-4 border-t border-stone-100">
          <div className="p-3 rounded-xl border border-stone-200/80 bg-stone-50/70">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="h-8 w-8 rounded-full bg-stone-900 text-white flex items-center justify-center text-xs font-bold">
                  SM
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-stone-900 truncate">
                  {DEMO_MERCHANT.name}
                </p>
                <p className="text-[10px] text-stone-500 truncate flex items-center gap-1">
                  <Database className="h-2.5 w-2.5 text-emerald-600" />
                  <span>Supabase Live</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
