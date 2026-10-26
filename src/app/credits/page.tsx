"use client";

import React, { useEffect, useState } from "react";
import {
  Coins,
  TrendingUp,
  Receipt,
  Info,
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { formatCurrencyBDT } from "@/lib/utils";
import { useAuth } from "@/lib/auth/auth-context";
import { Store, ShieldAlert } from "lucide-react";

interface UsageData {
  totalAttempts: number;
  completedAttempts: number;
  failedAttempts: number;
  processingAttempts: number;
  totalCreditsUsed: number;
  totalCostUSD: number;
  totalCostBDT: number;
  usdToBdtRate: number;
  creditsPerGen: number;
  costPerCreditUSD: number;
  history: Array<{
    id: string;
    provider: string;
    providerTaskId?: string | null;
    status: string;
    creditCostEstimate: number;
    createdAt: string;
    completedAt?: string | null;
  }>;
}

export default function CreditsPage() {
  const { isCustomer, demoMode, switchDemoRole } = useAuth();
  const [data, setData] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isCustomer) return;

    let ignore = false;
    async function loadUsage() {
      try {
        const res = await fetch("/api/credits/usage");
        const json = await res.json();
        if (!ignore && json.success) {
          setData(json.data);
        }
      } catch (err) {
        console.error("Failed to load credits usage:", err);
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }
    loadUsage();
    return () => {
      ignore = true;
    };
  }, [isCustomer]);

  if (isCustomer) {
    return (
      <DashboardLayout
        title="Credits & Usage — Access Restricted"
        subtitle="Customer accounts have view-only access without billing responsibilities"
      >
        <Card className="max-w-lg mx-auto my-12 border-amber-200 bg-amber-50/50 text-center p-8 space-y-5">
          <div className="h-14 w-14 rounded-2xl bg-amber-100 text-amber-800 mx-auto flex items-center justify-center">
            <ShieldAlert className="h-7 w-7" />
          </div>
          <div className="space-y-2">
            <h2 className="text-lg font-bold text-stone-900">
              Customer Account (View Only)
            </h2>
            <p className="text-xs text-stone-600">
              Credits and 3D generation billing telemetry are managed by <strong>Merchants</strong> and <strong>SaaS Administrators</strong>. Switch role to view real-time credits consumption and BDT conversion metrics.
            </p>
          </div>
          <div className="pt-2">
            {demoMode && (
            <Button
              onClick={() => switchDemoRole("merchant")}
              className="gap-2 bg-amber-700 hover:bg-amber-800 text-white shadow-xs"
            >
              <Store className="h-4 w-4" />
              <span>Switch to Merchant Account</span>
            </Button>
            )}
          </div>
        </Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="Credits & Usage"
      subtitle="Track your Meshy AI multi-image 3D generation usage and estimated currency costs"
    >
      <div className="space-y-8 max-w-6xl">
        {/* Cost & Credit Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-stone-200/80 bg-white">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <span className="text-xs font-medium text-stone-500 uppercase tracking-wider">
                Credits Used
              </span>
              <Coins className="h-4 w-4 text-amber-600" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <div className="text-2xl font-bold tracking-tight text-stone-900">
                  {data?.totalCreditsUsed || 0}
                </div>
              )}
              <p className="text-xs text-stone-500 mt-1">
                @ {data?.creditsPerGen || 20} credits / 3D model
              </p>
            </CardContent>
          </Card>

          <Card className="border-stone-200/80 bg-white">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <span className="text-xs font-medium text-stone-500 uppercase tracking-wider">
                Est. Cost (BDT)
              </span>
              <Receipt className="h-4 w-4 text-emerald-600" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <div className="text-2xl font-bold tracking-tight text-stone-900">
                  {formatCurrencyBDT(data?.totalCostUSD || 0, data?.usdToBdtRate || 122.5)}
                </div>
              )}
              <p className="text-xs text-stone-500 mt-1">
                Rate: 1 USD ≈ ৳{data?.usdToBdtRate || 122.5}
              </p>
            </CardContent>
          </Card>

          <Card className="border-stone-200/80 bg-white">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <span className="text-xs font-medium text-stone-500 uppercase tracking-wider">
                Total Attempts
              </span>
              <TrendingUp className="h-4 w-4 text-stone-400" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl font-bold tracking-tight text-stone-900">
                  {data?.totalAttempts || 0}
                </div>
              )}
              <p className="text-xs text-stone-500 mt-1">
                {data?.completedAttempts || 0} completed • {data?.failedAttempts || 0} failed
              </p>
            </CardContent>
          </Card>

          <Card className="border-stone-200/80 bg-white">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <span className="text-xs font-medium text-stone-500 uppercase tracking-wider">
                Demo Credits Left
              </span>
              <Coins className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tracking-tight text-amber-700">
                {Math.max(0, 100 - (data?.totalCreditsUsed || 0))}
              </div>
              <p className="text-xs text-stone-500 mt-1">Sandbox demo balance</p>
            </CardContent>
          </Card>
        </div>

        {/* Pricing Transparency Card */}
        <Card className="border-stone-200/80 bg-stone-50/50">
          <CardContent className="p-4 flex items-start gap-3">
            <Info className="h-4 w-4 text-stone-500 shrink-0 mt-0.5" />
            <div className="text-xs text-stone-600 space-y-1">
              <p className="font-semibold text-stone-900">
                Transparent Costing Configuration
              </p>
              <p>
                Meshy AI standard multi-image generation consumes an estimated{" "}
                <strong>{data?.creditsPerGen || 20} credits</strong> per task. Currency conversions are calculated dynamically at the configured exchange rate (1 USD = ৳{data?.usdToBdtRate || 122.5}). This dashboard is currently operating in sandbox demo mode with zero actual billing charges.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Generation Audit Log Table */}
        <Card className="border-stone-200/80 bg-white">
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-stone-900">
              Generation Attempts History
            </CardTitle>
            <CardDescription className="text-xs">
              Complete audit log of all 3D model generation requests and provider statuses
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : !data || data.history.length === 0 ? (
              <div className="text-center py-8 text-xs text-stone-400">
                No generation attempts recorded yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-stone-200 text-stone-500">
                      <th className="pb-3 font-semibold">Attempt ID</th>
                      <th className="pb-3 font-semibold">Provider</th>
                      <th className="pb-3 font-semibold">Status</th>
                      <th className="pb-3 font-semibold">Credit Cost</th>
                      <th className="pb-3 font-semibold">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {data.history.map((row) => (
                      <tr key={row.id} className="hover:bg-stone-50/50">
                        <td className="py-3 font-mono text-[11px] text-stone-700">
                          {row.id}
                        </td>
                        <td className="py-3 font-medium text-stone-800">
                          Meshy AI (Multi-Image)
                        </td>
                        <td className="py-3">
                          <Badge
                            variant={
                              row.status === "completed"
                                ? "success"
                                : row.status === "processing"
                                ? "processing"
                                : row.status === "failed"
                                ? "destructive"
                                : "secondary"
                            }
                          >
                            {row.status}
                          </Badge>
                        </td>
                        <td className="py-3 font-semibold text-stone-900">
                          {row.creditCostEstimate} credits
                        </td>
                        <td className="py-3 text-stone-500">
                          {new Date(row.createdAt).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
