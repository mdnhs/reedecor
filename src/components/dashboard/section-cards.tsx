"use client";

import React from "react";
import { Box, CheckCircle2, Coins, Sparkles, type LucideIcon } from "lucide-react";
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { StoredProduct } from "@/server/demo-store";
import { computeStats } from "@/lib/dashboard-stats";

export interface CreditSummary {
  remaining: number;
  allowance: number;
}

interface SectionCardsProps {
  products: StoredProduct[];
  credits?: CreditSummary | null;
}

function StatCard({
  label,
  value,
  icon: Icon,
  detail,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  detail: string;
}) {
  return (
    <Card className="shadow-xs">
      <CardHeader className="pb-2">
        <CardDescription className="flex items-center gap-1.5 text-xs font-medium text-stone-500">
          <Icon className="h-3.5 w-3.5 text-amber-600" />
          {label}
        </CardDescription>
        <CardTitle className="text-2xl sm:text-3xl font-bold tracking-tight text-stone-900 tabular-nums">
          {value}
        </CardTitle>
      </CardHeader>
      <CardFooter className="pt-0 text-xs text-stone-500">{detail}</CardFooter>
    </Card>
  );
}

export function SectionCards({ products, credits }: SectionCardsProps) {
  const stats = computeStats(products);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-4 gap-4">
      <StatCard
        label="3D Products"
        value={String(stats.total)}
        icon={Box}
        detail={`${stats.completed} ready to view in 3D`}
      />
      <StatCard
        label="Generation Success Rate"
        value={stats.successRate === null ? "—" : `${stats.successRate}%`}
        icon={CheckCircle2}
        detail={stats.successRate === null ? "No finished generations yet" : "Of finished AI generations, excluding cancels"}
      />
      <StatCard
        label="AI Generation Tasks"
        value={String(stats.attempts)}
        icon={Sparkles}
        detail={stats.processing > 0 ? `${stats.processing} running now` : "None running now"}
      />
      <StatCard
        label="Credits Left"
        value={credits ? String(credits.remaining) : "—"}
        icon={Coins}
        detail={credits ? `of ${credits.allowance} included credits` : "Credits apply to merchant accounts"}
      />
    </div>
  );
}
