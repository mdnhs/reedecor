"use client";

import React, { useEffect, useState } from "react";
import { ShieldAlert, Store, Coins, Receipt, CheckCircle2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatCardsSkeleton, TableSkeleton } from "@/components/ui/skeleton-patterns";
import { formatCurrencyBDT } from "@/lib/utils";
import { useAuth } from "@/lib/auth/auth-context";

interface UsageData {
  totalAttempts: number;
  completedAttempts: number;
  failedAttempts: number;
  processingAttempts: number;
  allowance: number;
  used: number;
  remaining: number;
  singleImageCost: number;
  multiImageCost: number;
  totalCostUSD: number;
  totalCostBDT: number;
  usdToBdtRate: number;
  costPerCreditUSD: number;
  history: Array<{
    id: string;
    productName: string;
    provider: string;
    providerTaskId?: string | null;
    status: string;
    creditCostEstimate: number;
    createdAt: string;
    completedAt?: string | null;
  }>;
}

export default function CreditsPage() {
  const { user, isCustomer, demoMode, switchDemoRole } = useAuth();
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
  }, [user?.id, isCustomer]);

  if (isCustomer) {
    return (
      <div className="glass-panel studio-card-shadow mx-auto my-12 max-w-lg space-y-4 rounded-2xl p-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-stone-100 text-stone-600">
          <ShieldAlert className="h-6 w-6" />
        </div>
        <h2 className="font-display text-lg font-bold text-stone-900">Merchants only</h2>
        {demoMode && (
          <Button onClick={() => switchDemoRole("merchant")} className="gap-2 bg-gradient-brand text-white">
            <Store className="h-4 w-4" />
            <span>Switch to merchant</span>
          </Button>
        )}
      </div>
    );
  }

  const usedPercent = data && data.allowance > 0 ? Math.min(100, (data.used / data.allowance) * 100) : 0;

  return (
    <div className="mx-auto max-w-3xl space-y-12 pb-12">
        <section aria-labelledby="balance-title" className="space-y-4">
          <h2 id="balance-title" className="font-display text-lg font-bold text-stone-900">
            Credits
          </h2>
          {loading ? (
            <StatCardsSkeleton />
          ) : !data ? (
            <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
              Could not load usage.
            </p>
          ) : (
            <div className="glass-panel studio-card-shadow space-y-4 rounded-2xl p-6">
              <div className="flex items-end justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Coins className="h-8 w-8 text-amber-600" />
                  <p className="font-display text-5xl font-bold tracking-tight text-stone-900">{data.remaining}</p>
                </div>
                <p className="text-sm text-stone-500">/ {data.allowance}</p>
              </div>
              <div
                role="progressbar"
                aria-label="Credits used"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(usedPercent)}
                className="h-3 w-full overflow-hidden rounded-full bg-stone-100"
              >
                <div className="h-full rounded-full bg-gradient-brand" style={{ width: `${usedPercent}%` }} />
              </div>
              <div className="grid grid-cols-3 gap-3 pt-2">
                <div className="flex items-center gap-2 rounded-xl bg-stone-50 p-3" title="Estimated cost">
                  <span className="sr-only">Estimated cost</span>
                  <Receipt className="h-4 w-4 shrink-0 text-stone-500" />
                  <span className="text-sm font-semibold text-stone-900">
                    {formatCurrencyBDT(data.totalCostUSD, data.usdToBdtRate)}
                  </span>
                </div>
                <div className="flex items-center gap-2 rounded-xl bg-stone-50 p-3" title="Completed">
                  <span className="sr-only">Completed</span>
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                  <span className="text-sm font-semibold text-stone-900">{data.completedAttempts}</span>
                </div>
                <div className="flex items-center gap-2 rounded-xl bg-stone-50 p-3" title="Failed">
                  <span className="sr-only">Failed</span>
                  <XCircle className="h-4 w-4 shrink-0 text-rose-500" />
                  <span className="text-sm font-semibold text-stone-900">{data.failedAttempts}</span>
                </div>
              </div>
            </div>
          )}
        </section>

        <section aria-labelledby="usage-title" className="space-y-4">
          <h2 id="usage-title" className="font-display text-lg font-bold text-stone-900">
            Recent usage
          </h2>
          {loading ? (
            <TableSkeleton rows={3} />
          ) : !data || data.history.length === 0 ? (
            <p className="text-sm text-stone-400">No usage yet</p>
          ) : (
            <ul className="divide-y divide-stone-100 rounded-2xl border border-stone-200 bg-white">
              {data.history.map((row) => (
                <li key={row.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-stone-900">{row.productName}</p>
                    <p className="text-xs text-stone-500">{new Date(row.createdAt).toLocaleString()}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
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
                    <span className="w-20 text-right text-sm font-semibold text-stone-900">
                      {row.creditCostEstimate} credits
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
  );
}
