"use client";

import React, { useState } from "react";
import {
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const chartData90d = [
  { date: "Aug 01", completed: 3, attempts: 3 },
  { date: "Aug 10", completed: 5, attempts: 6 },
  { date: "Aug 20", completed: 8, attempts: 8 },
  { date: "Aug 30", completed: 11, attempts: 12 },
  { date: "Sep 08", completed: 14, attempts: 15 },
  { date: "Sep 18", completed: 18, attempts: 19 },
  { date: "Sep 28", completed: 22, attempts: 24 },
  { date: "Oct 05", completed: 27, attempts: 28 },
  { date: "Oct 12", completed: 31, attempts: 32 },
  { date: "Oct 21", completed: 35, attempts: 36 },
];

const chartData30d = [
  { date: "Sep 22", completed: 2, attempts: 2 },
  { date: "Sep 26", completed: 4, attempts: 5 },
  { date: "Sep 30", completed: 7, attempts: 7 },
  { date: "Oct 04", completed: 11, attempts: 12 },
  { date: "Oct 08", completed: 15, attempts: 16 },
  { date: "Oct 12", completed: 18, attempts: 19 },
  { date: "Oct 16", completed: 22, attempts: 23 },
  { date: "Oct 21", completed: 26, attempts: 27 },
];

const chartData7d = [
  { date: "Thu", completed: 1, attempts: 1 },
  { date: "Fri", completed: 3, attempts: 3 },
  { date: "Sat", completed: 4, attempts: 4 },
  { date: "Sun", completed: 5, attempts: 6 },
  { date: "Mon", completed: 7, attempts: 7 },
  { date: "Tue", completed: 9, attempts: 9 },
  { date: "Today", completed: 12, attempts: 12 },
];

export function ChartAreaInteractive() {
  const [timeRange, setTimeRange] = useState<"90d" | "30d" | "7d">("30d");

  const data =
    timeRange === "90d" ? chartData90d : timeRange === "30d" ? chartData30d : chartData7d;

  return (
    <Card className="bg-white border-stone-200/80 shadow-xs">
      <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 space-y-2 sm:space-y-0">
        <div>
          <CardTitle className="text-base font-bold text-stone-900">
            3D Mesh Reconstruction Telemetry
          </CardTitle>
          <CardDescription className="text-xs text-stone-500">
            Multi-angle photo processing & GLB model generation throughput
          </CardDescription>
        </div>

        {/* Time Filter Pills */}
        <div className="flex items-center gap-1 bg-stone-100 p-1 rounded-lg border border-stone-200/80">
          <button
            onClick={() => setTimeRange("90d")}
            className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
              timeRange === "90d"
                ? "bg-white text-stone-900 shadow-2xs font-bold"
                : "text-stone-500 hover:text-stone-900"
            }`}
          >
            Last 3 months
          </button>
          <button
            onClick={() => setTimeRange("30d")}
            className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
              timeRange === "30d"
                ? "bg-white text-stone-900 shadow-2xs font-bold"
                : "text-stone-500 hover:text-stone-900"
            }`}
          >
            Last 30 days
          </button>
          <button
            onClick={() => setTimeRange("7d")}
            className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
              timeRange === "7d"
                ? "bg-white text-stone-900 shadow-2xs font-bold"
                : "text-stone-500 hover:text-stone-900"
            }`}
          >
            Last 7 days
          </button>
        </div>
      </CardHeader>

      <CardContent className="px-2 pt-2 sm:px-6">
        <div className="h-[250px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="fillCompleted" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#b45309" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#b45309" stopOpacity={0.01} />
                </linearGradient>
                <linearGradient id="fillAttempts" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.01} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f0ee" />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tick={{ fontSize: 11, fill: "#78716c" }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tick={{ fontSize: 11, fill: "#78716c" }}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="rounded-lg border border-stone-200 bg-white p-2.5 shadow-md text-xs">
                        <p className="font-bold text-stone-900">{label}</p>
                        <div className="mt-1.5 space-y-1">
                          <p className="text-amber-700 font-medium">
                            Completed 3D: <strong>{payload[0]?.value}</strong>
                          </p>
                          <p className="text-emerald-700 font-medium">
                            Total Attempts: <strong>{payload[1]?.value}</strong>
                          </p>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Area
                type="natural"
                dataKey="completed"
                stroke="#b45309"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#fillCompleted)"
              />
              <Area
                type="natural"
                dataKey="attempts"
                stroke="#10b981"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#fillAttempts)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
