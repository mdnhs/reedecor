"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Box,
  Coins,
  ImagePlus,
  Layers,
  ShieldCheck,
  Sparkles,
  Store,
  type LucideIcon,
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Skeleton } from "@/components/ui/skeleton";
import { StoredProduct } from "@/server/demo-store";
import { useAuth } from "@/lib/auth/auth-context";
import { SectionCards, type CreditSummary } from "@/components/dashboard/section-cards";
import { ChartAreaInteractive } from "@/components/dashboard/chart-area-interactive";
import { DataTable } from "@/components/dashboard/data-table";
import { RecentCreations } from "@/components/dashboard/recent-creations";
import { GenerationStatus } from "@/components/dashboard/generation-status";
import { useFeature } from "@/lib/features/features-context";

interface QuickAction {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
  tile: string;
  show: boolean;
}

function Orb({ className }: { className: string }) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute rounded-full bg-radial-[at_30%_30%] from-white via-sky-200 to-amber-400 opacity-80 shadow-xl shadow-amber-500/20 ${className}`}
    />
  );
}

export default function OverviewPage() {
  const { user, isSaasAdmin, isCustomer } = useAuth();
  const generationOn = useFeature("model_generation");
  const [products, setProducts] = useState<StoredProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [credits, setCredits] = useState<CreditSummary | null>(null);

  useEffect(() => {
    let ignore = false;
    async function loadData() {
      try {
        const res = await fetch("/api/products");
        const json = await res.json();
        if (!ignore && json.success) {
          setProducts(json.data);
        }
      } catch (err) {
        console.error("Failed to load products:", err);
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }
    loadData();
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    if (isCustomer || isSaasAdmin) return;
    let ignore = false;
    fetch("/api/credits/usage")
      .then((res) => res.json())
      .then((json) => {
        if (!ignore && json.success) setCredits({ remaining: json.data.remaining, allowance: json.data.allowance });
      })
      .catch(() => {});
    return () => {
      ignore = true;
    };
  }, [isCustomer, isSaasAdmin]);

  const canCreate = !isCustomer && generationOn;
  const storeHref = `/store/${user?.id || "demo-merchant-001"}`;

  const quickActions: QuickAction[] = [
    {
      title: "Create 3D Model",
      description: "Turn product photos into an AI-generated model",
      href: "/create",
      icon: ImagePlus,
      tile: "from-pink-400 to-rose-500",
      show: canCreate,
    },
    {
      title: "My Products",
      description: "Manage your furniture catalog",
      href: "/products",
      icon: Box,
      tile: "from-amber-400 to-amber-700",
      show: true,
    },
    {
      title: "Public Store",
      description: "See your storefront as customers do",
      href: storeHref,
      icon: Store,
      tile: "from-sky-400 to-blue-600",
      show: true,
    },
    {
      title: "Credits & Usage",
      description: "Track generation credits",
      href: "/credits",
      icon: Coins,
      tile: "from-orange-300 to-orange-500",
      show: !isCustomer,
    },
    {
      title: "Admin RBAC",
      description: "Manage users and roles",
      href: "/admin/rbac",
      icon: ShieldCheck,
      tile: "from-emerald-400 to-teal-600",
      show: isSaasAdmin,
    },
  ];
  const visibleActions = quickActions.filter((a) => a.show).slice(0, 4);

  return (
    <DashboardLayout title="Home" subtitle="Furniture catalog, 3D models and generation activity">
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 min-w-0 xl:col-span-2">
          <section className="relative overflow-hidden rounded-3xl bg-linear-to-b from-white/40 to-white/0 px-4 pb-6 pt-16 text-center sm:pt-20">
            <Orb className="left-6 top-8 h-12 w-12 sm:left-14" />
            <Orb className="right-8 top-6 h-20 w-20 sm:right-20" />
            <Orb className="right-4 top-40 h-8 w-8 sm:right-10" />
            <div
              aria-hidden
              className="bg-gradient-brand pointer-events-none absolute left-1/2 top-0 h-40 w-72 -translate-x-1/2 rounded-full opacity-25 blur-3xl"
            />

            <p className="relative text-xs font-semibold uppercase tracking-widest text-stone-500">
              {isCustomer ? "Shop in three dimensions" : "Turn photos into 3D"}
            </p>
            <h2 className="relative mt-3 font-display text-4xl font-extrabold tracking-tight sm:text-5xl">
              {isCustomer ? "Explore " : "Create "}
              <span className="text-gradient-brand">Anything</span>
            </h2>
            <p className="relative mx-auto mt-3 max-w-md text-sm text-stone-500">
              {isCustomer
                ? "Rotate, zoom and inspect real dimensions of furniture right in your browser."
                : "Upload front, back, left and right photos. Meshy AI reconstructs a 3D model with PBR materials, ready for WebGL and GLB export."}
            </p>

            <div className="group relative mx-auto mt-7 flex max-w-xl items-center gap-3 rounded-3xl bg-white p-3 pl-4 text-left shadow-xl shadow-amber-900/5 transition-shadow hover:shadow-amber-900/10">
              <Sparkles className="h-5 w-5 shrink-0 text-amber-600" />
              <div className="min-w-0 flex-1">
                <Link
                  href={canCreate ? "/create" : "/products"}
                  className="block truncate text-sm text-stone-500 after:absolute after:inset-0 after:rounded-3xl after:content-['']"
                >
                  {canCreate ? "Upload product photos to generate a 3D model…" : "Browse the 3D furniture catalog…"}
                </Link>
                {canCreate && (
                  <div className="mt-2 hidden flex-wrap gap-1.5 sm:flex">
                    {[
                      { label: "Single image", href: "/create/single" },
                      { label: "Multi-angle", href: "/create/multi" },
                    ].map((chip) => (
                      <Link
                        key={chip.href}
                        href={chip.href}
                        className="relative z-10 rounded-full border border-stone-200 px-2.5 py-1 text-xs font-medium text-stone-600 transition-colors hover:border-amber-300 hover:text-amber-800"
                      >
                        {chip.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
              <span className="bg-gradient-brand flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white shadow-lg shadow-amber-700/30 transition-transform group-hover:translate-x-0.5">
                <ArrowRight className="h-5 w-5" />
              </span>
            </div>
            {canCreate && (
              <p className="relative mt-3 text-xs text-stone-400">
                3D models are AI-generated by Meshy from your photos.
              </p>
            )}
          </section>

          <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {visibleActions.map((action) => (
              <Link
                key={action.title}
                href={action.href}
                className="group rounded-3xl bg-white/70 p-4 transition-all hover:-translate-y-0.5 hover:bg-white hover:shadow-lg hover:shadow-amber-900/5"
              >
                <div className="flex items-start justify-between">
                  <span
                    className={`flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br text-white shadow-md ${action.tile}`}
                  >
                    <action.icon className="h-5 w-5" />
                  </span>
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-stone-100 text-stone-500 group-hover:bg-amber-50 group-hover:text-amber-700">
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </span>
                </div>
                <p className="mt-4 text-sm font-semibold">{action.title}</p>
                <p className="mt-1 text-xs text-stone-500">{action.description}</p>
              </Link>
            ))}
          </section>

          {isCustomer ? null : loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-32 w-full rounded-2xl" />
              ))}
            </div>
          ) : (
            <SectionCards products={products} credits={isSaasAdmin ? null : credits} />
          )}
        </div>

        <aside className="flex min-w-0 flex-col gap-4">
          <RecentCreations products={products} loading={loading} className="flex-1" />
          {!isCustomer && <GenerationStatus products={products} loading={loading} />}

          <div className="relative overflow-hidden rounded-3xl bg-linear-to-br from-sky-100 via-amber-100 to-pink-100 p-5">
            <div className="bg-gradient-brand absolute -bottom-8 -right-8 flex h-32 w-32 items-center justify-center rounded-full opacity-90">
              <Layers className="h-10 w-10 text-white/80" />
            </div>
            <p className="relative font-display text-base font-bold">3D Room Studio</p>
            <p className="relative mt-1 max-w-48 text-xs text-stone-600">
              Stage your products in a room scene before you publish.
            </p>
            <Link
              href="/products"
              className="relative mt-4 inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-xs font-semibold shadow-sm hover:text-amber-700"
            >
              Open products
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </aside>

        {!isCustomer && (
          <div className="min-w-0 xl:col-span-3">
            {loading ? (
              <Skeleton className="h-80 w-full rounded-2xl" />
            ) : (
              <ChartAreaInteractive
                products={products}
                scope={isSaasAdmin ? "Finished 3D generation attempts across all merchants" : "Finished 3D generation attempts across your products"}
              />
            )}
          </div>
        )}

        <div className="min-w-0 xl:col-span-3">
          {loading ? <Skeleton className="h-64 w-full rounded-2xl" /> : <DataTable products={products} />}
        </div>
      </div>
    </DashboardLayout>
  );
}
