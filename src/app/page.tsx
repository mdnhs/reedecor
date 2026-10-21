"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, ArrowRight, Sparkles, ShieldCheck } from "lucide-react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StoredProduct } from "@/server/demo-store";
import { useAuth } from "@/lib/auth/auth-context";
import { SectionCards } from "@/components/dashboard/section-cards";
import { ChartAreaInteractive } from "@/components/dashboard/chart-area-interactive";
import { DataTable } from "@/components/dashboard/data-table";

export default function OverviewPage() {
  const { isSaasAdmin, isCustomer } = useAuth();
  const [products, setProducts] = useState<StoredProduct[]>([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <DashboardLayout
      title="Studio Overview"
      subtitle="shadcn dashboard-01 block • Furniture catalog, 3D mesh telemetry & generation controls"
    >
      <div className="space-y-6">
        {/* Hero Welcome Banner */}
        <div className="relative overflow-hidden rounded-2xl border border-stone-200/90 bg-white p-6 sm:p-7 shadow-xs">
          <div className="relative z-10 max-w-2xl space-y-2.5">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200/70 text-amber-900 text-xs font-semibold">
              <Sparkles className="h-3.5 w-3.5 text-amber-600" />
              <span>
                {isSaasAdmin
                  ? "SaaS Admin Dashboard — System Overview & RBAC"
                  : isCustomer
                  ? "Customer Storefront — 3D WebGL Furniture Collection"
                  : "Merchant 3D Studio — Multi-Angle AI Generation"}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-stone-900 font-display">
              {isCustomer
                ? "Browse modern furniture pieces in interactive 3D WebGL"
                : "Transform furniture photographs into interactive 3D models"}
            </h2>
            <p className="text-xs sm:text-sm text-stone-500 max-w-xl">
              {isCustomer
                ? "Rotate, zoom, and inspect physical dimensions of hand-crafted furniture pieces directly in your browser."
                : "Upload 4 perspective angles (Front, Back, Left, Right). Meshy AI reconstructs realistic 3D geometries with 2K PBR materials ready for WebGL inspection and GLB export."}
            </p>
            <div className="pt-2 flex flex-wrap items-center gap-3">
              {isSaasAdmin && (
                <Link href="/admin/rbac">
                  <Button className="gap-2 bg-stone-900 hover:bg-stone-800 text-white shadow-xs">
                    <ShieldCheck className="h-4 w-4 text-amber-400" />
                    <span>Manage RBAC Users</span>
                  </Button>
                </Link>
              )}
              {!isCustomer && (
                <Link href="/create">
                  <Button className="gap-2 bg-amber-700 hover:bg-amber-800 text-white shadow-xs">
                    <Plus className="h-4 w-4" />
                    <span>Create 3D Model</span>
                  </Button>
                </Link>
              )}
              <Link href="/products">
                <Button variant="outline" className="gap-1.5 border-stone-200 text-stone-700 hover:bg-stone-50">
                  <span>View Full Catalog</span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
          <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-radial from-amber-50/40 via-stone-50/20 to-transparent pointer-events-none hidden md:block" />
        </div>

        {/* 1. shadcn dashboard-01: SectionCards (KPI Metrics) */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-32 w-full rounded-xl" />
            ))}
          </div>
        ) : (
          <SectionCards products={products} />
        )}

        {/* 2. shadcn dashboard-01: ChartAreaInteractive */}
        <ChartAreaInteractive />

        {/* 3. shadcn dashboard-01: DataTable */}
        {loading ? (
          <Skeleton className="h-64 w-full rounded-xl" />
        ) : (
          <DataTable products={products} />
        )}
      </div>
    </DashboardLayout>
  );
}
