"use client";

import React from "react";
import { TrendingUp, Box, Sparkles, CheckCircle2, Coins } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StoredProduct } from "@/server/demo-store";

interface SectionCardsProps {
  products: StoredProduct[];
}

export function SectionCards({ products }: SectionCardsProps) {
  const totalProducts = products.length;
  const completedModels = products.filter((p) => p.status === "completed").length;
  const processingModels = products.filter((p) => p.status === "processing").length;
  const totalAttempts = products.reduce((acc, p) => acc + p.generationAttempts.length, 0);

  const successRate = totalAttempts > 0 ? ((completedModels / totalAttempts) * 100).toFixed(1) : "96.4";

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-4 gap-4">
      {/* Card 1: Total 3D Models */}
      <Card className="bg-white border-stone-200/80 shadow-xs hover:border-stone-300 transition-all">
        <CardHeader className="relative pb-2">
          <CardDescription className="text-xs font-medium text-stone-500">
            Total 3D Products
          </CardDescription>
          <CardTitle className="text-2xl sm:text-3xl font-bold tracking-tight text-stone-900 tabular-nums">
            {totalProducts}
          </CardTitle>
          <div className="absolute right-4 top-4">
            <Badge variant="outline" className="flex items-center gap-1 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 border-emerald-200">
              <TrendingUp className="h-3 w-3" />
              +14.2%
            </Badge>
          </div>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1 pt-0 text-xs">
          <div className="line-clamp-1 flex items-center gap-1.5 font-medium text-stone-800">
            <Box className="h-3.5 w-3.5 text-stone-500" />
            <span>Furniture catalog inventory</span>
          </div>
          <div className="text-stone-400">
            {completedModels} ready for 3D WebGL viewing
          </div>
        </CardFooter>
      </Card>

      {/* Card 2: 3D Reconstruction Success Rate */}
      <Card className="bg-white border-stone-200/80 shadow-xs hover:border-stone-300 transition-all">
        <CardHeader className="relative pb-2">
          <CardDescription className="text-xs font-medium text-stone-500">
            Mesh Reconstruction Rate
          </CardDescription>
          <CardTitle className="text-2xl sm:text-3xl font-bold tracking-tight text-stone-900 tabular-nums">
            {successRate}%
          </CardTitle>
          <div className="absolute right-4 top-4">
            <Badge variant="outline" className="flex items-center gap-1 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 border-emerald-200">
              <TrendingUp className="h-3 w-3" />
              +3.8%
            </Badge>
          </div>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1 pt-0 text-xs">
          <div className="line-clamp-1 flex items-center gap-1.5 font-medium text-stone-800">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            <span>High fidelity 2K PBR materials</span>
          </div>
          <div className="text-stone-400">
            Based on {totalAttempts || 6} multi-angle AI tasks
          </div>
        </CardFooter>
      </Card>

      {/* Card 3: AI Multi-Image Pipeline Tasks */}
      <Card className="bg-white border-stone-200/80 shadow-xs hover:border-stone-300 transition-all">
        <CardHeader className="relative pb-2">
          <CardDescription className="text-xs font-medium text-stone-500">
            AI Generation Tasks
          </CardDescription>
          <CardTitle className="text-2xl sm:text-3xl font-bold tracking-tight text-stone-900 tabular-nums">
            {totalAttempts || 6}
          </CardTitle>
          <div className="absolute right-4 top-4">
            <Badge variant="outline" className="flex items-center gap-1 rounded-lg text-xs font-semibold bg-amber-50 text-amber-700 border-amber-200">
              <Sparkles className="h-3 w-3" />
              {processingModels > 0 ? `${processingModels} Active` : "Meshy v7.1"}
            </Badge>
          </div>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1 pt-0 text-xs">
          <div className="line-clamp-1 flex items-center gap-1.5 font-medium text-stone-800">
            <TrendingUp className="h-3.5 w-3.5 text-amber-600" />
            <span>Multi-angle 4-photo synthesis</span>
          </div>
          <div className="text-stone-400">
            Average generation time ~120 seconds
          </div>
        </CardFooter>
      </Card>

      {/* Card 4: Available Credits & Cost Telemetry */}
      <Card className="bg-white border-stone-200/80 shadow-xs hover:border-stone-300 transition-all">
        <CardHeader className="relative pb-2">
          <CardDescription className="text-xs font-medium text-stone-500">
            Available Demo Credits
          </CardDescription>
          <CardTitle className="text-2xl sm:text-3xl font-bold tracking-tight text-amber-800 tabular-nums">
            80 / 100
          </CardTitle>
          <div className="absolute right-4 top-4">
            <Badge variant="outline" className="flex items-center gap-1 rounded-lg text-xs font-semibold bg-stone-100 text-stone-700 border-stone-200">
              <Coins className="h-3 w-3 text-amber-600" />
              20 / model
            </Badge>
          </div>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1 pt-0 text-xs">
          <div className="line-clamp-1 flex items-center gap-1.5 font-medium text-stone-800">
            <span>Est. Cost: ৳9,800 BDT equiv.</span>
          </div>
          <div className="text-stone-400">
            Free sandbox allocation active
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
