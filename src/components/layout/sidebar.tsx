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
} from "lucide-react";
import { cn } from "@/lib/utils";

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
    <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 border-r border-stone-200/80 bg-white/70 backdrop-blur-md dark:border-stone-800 dark:bg-stone-900/70 z-30">
      {/* Brand Header */}
      <div className="flex h-16 items-center px-6 border-b border-stone-200/60 dark:border-stone-800/60 gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-stone-900 text-stone-50 shadow-xs dark:bg-stone-100 dark:text-stone-900">
          <Layers className="h-5 w-5" />
        </div>
        <div className="flex flex-col">
          <span className="font-semibold text-sm tracking-tight text-stone-900 dark:text-stone-100">
            Artisan 3D
          </span>
          <span className="text-[11px] font-medium text-stone-500 uppercase tracking-wider">
            Merchant Studio
          </span>
        </div>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 flex flex-col justify-between px-3 py-6">
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
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "bg-stone-100 text-stone-900 dark:bg-stone-800 dark:text-stone-100 font-semibold"
                    : "text-stone-600 hover:bg-stone-50 hover:text-stone-900 dark:text-stone-400 dark:hover:bg-stone-800/50 dark:hover:text-stone-100",
                  item.highlight && !isActive && "text-amber-800 hover:text-amber-900 dark:text-amber-400"
                )}
              >
                <item.icon
                  className={cn(
                    "h-4 w-4 shrink-0",
                    isActive
                      ? "text-stone-900 dark:text-stone-100"
                      : "text-stone-400 group-hover:text-stone-600 dark:text-stone-500",
                    item.highlight && !isActive && "text-amber-700 dark:text-amber-400"
                  )}
                />
                <span>{item.name}</span>
                {item.highlight && (
                  <Sparkles className="ml-auto h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Demo Merchant Card */}
        <div className="p-3 rounded-xl border border-stone-200/80 bg-stone-50/50 dark:border-stone-800 dark:bg-stone-800/30">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-stone-300 dark:bg-stone-700 flex items-center justify-center text-xs font-semibold text-stone-800 dark:text-stone-200">
              SM
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-xs font-medium text-stone-900 dark:text-stone-200 truncate">
                Studio Merchant
              </p>
              <p className="text-[10px] text-stone-500 dark:text-stone-400 truncate">
                Demo Profile
              </p>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
