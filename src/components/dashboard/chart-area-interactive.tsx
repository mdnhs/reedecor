"use client";

import React, { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { attemptsByDay } from "@/lib/dashboard-stats";
import type { StoredProduct } from "@/server/demo-store";

const RANGES = [
  { days: 90, label: "Last 3 months" },
  { days: 30, label: "Last 30 days" },
  { days: 7, label: "Last 7 days" },
] as const;

const SERIES = [
  { key: "completed", label: "Completed", color: "#6141dc" },
  { key: "failed", label: "Failed", color: "#e11d48" },
] as const;

function formatDay(date: string) {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

export function ChartAreaInteractive({ products, scope }: { products: StoredProduct[]; scope: string }) {
  const [days, setDays] = useState<number>(30);
  const data = useMemo(() => attemptsByDay(products, days), [products, days]);
  const total = data.reduce((sum, d) => sum + d.completed + d.failed, 0);

  return (
    <Card className="shadow-xs">
      <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 gap-3">
        <div>
          <CardTitle className="text-base font-bold text-stone-900">AI Generations per Day</CardTitle>
          <CardDescription className="text-xs text-stone-500">{scope}</CardDescription>
        </div>
        <div className="flex items-center gap-1 rounded-full bg-stone-100 p-1" role="group" aria-label="Time range">
          {RANGES.map((range) => (
            <button
              key={range.days}
              onClick={() => setDays(range.days)}
              aria-pressed={days === range.days}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                days === range.days ? "bg-white text-stone-900 shadow-xs" : "text-stone-500 hover:text-stone-900"
              )}
            >
              {range.label}
            </button>
          ))}
        </div>
      </CardHeader>

      <CardContent className="px-2 pt-0 sm:px-6">
        <div className="mb-3 flex items-center gap-4 px-2 text-xs text-stone-600">
          {SERIES.map((s) => (
            <span key={s.key} className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: s.color }} />
              {s.label}
            </span>
          ))}
        </div>
        {total === 0 ? (
          <div className="flex h-64 items-center justify-center rounded-2xl bg-stone-50 text-xs text-stone-400">
            No finished generations in this period.
          </div>
        ) : (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }} barGap={2}>
                <CartesianGrid vertical={false} stroke="#e4e4f0" />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatDay}
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  minTickGap={24}
                  tick={{ fontSize: 11, fill: "#75768f" }}
                />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#75768f" }} />
                <Tooltip
                  cursor={{ fill: "#f0f0f8" }}
                  content={({ active, payload, label }) =>
                    active && payload?.length ? (
                      <div className="rounded-xl border border-stone-200 bg-white p-2.5 text-xs shadow-md">
                        <p className="font-semibold text-stone-900">{formatDay(String(label))}</p>
                        {SERIES.map((s) => (
                          <p key={s.key} className="mt-1 flex items-center gap-1.5 text-stone-600">
                            <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: s.color }} />
                            {s.label}: <strong className="text-stone-900">{payload.find((p) => p.dataKey === s.key)?.value ?? 0}</strong>
                          </p>
                        ))}
                      </div>
                    ) : null
                  }
                />
                {SERIES.map((s) => (
                  <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} radius={[4, 4, 0, 0]} maxBarSize={18} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
