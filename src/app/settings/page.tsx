"use client";

import React from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DEMO_MERCHANT } from "@/lib/constants";
import { Database, HardDrive, Cpu, ShieldCheck } from "lucide-react";

export default function SettingsPage() {
  return (
    <DashboardLayout
      title="Studio Settings"
      subtitle="View your merchant profile, integration statuses, and environment configuration"
    >
      <div className="max-w-4xl space-y-6">
        {/* Merchant Profile Card */}
        <Card className="border-stone-200/80 bg-white">
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-stone-900">
              Merchant Profile
            </CardTitle>
            <CardDescription className="text-xs">
              Current active merchant session credentials
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-stone-900 text-stone-50 flex items-center justify-center font-bold text-sm">
                SM
              </div>
              <div>
                <h4 className="font-semibold text-stone-900 text-sm">
                  {DEMO_MERCHANT.name}
                </h4>
                <p className="text-xs text-stone-500">{DEMO_MERCHANT.email}</p>
                <div className="mt-1">
                  <Badge variant="secondary" className="text-[10px]">
                    Demo Merchant Profile
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Integration Statuses */}
        <Card className="border-stone-200/80 bg-white">
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-stone-900">
              Integration & Provider Statuses
            </CardTitle>
            <CardDescription className="text-xs">
              Connected cloud databases, storage buckets, and AI 3D providers
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg border border-stone-100 bg-stone-50/50">
              <div className="flex items-center gap-3">
                <Database className="h-4 w-4 text-emerald-600" />
                <div>
                  <p className="text-xs font-semibold text-stone-900">
                    Supabase PostgreSQL (via Drizzle ORM)
                  </p>
                  <p className="text-[11px] text-stone-500">
                    Project Ref: aafouqxsgibfqjcxozii
                  </p>
                </div>
              </div>
              <Badge variant="success">Active</Badge>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border border-stone-100 bg-stone-50/50">
              <div className="flex items-center gap-3">
                <HardDrive className="h-4 w-4 text-emerald-600" />
                <div>
                  <p className="text-xs font-semibold text-stone-900">
                    Supabase Storage & IndexedDB Cache
                  </p>
                  <p className="text-[11px] text-stone-500">
                    Bucket: furniture-3d-studio + Browser local IDB
                  </p>
                </div>
              </div>
              <Badge variant="success">Ready</Badge>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border border-stone-100 bg-stone-50/50">
              <div className="flex items-center gap-3">
                <Cpu className="h-4 w-4 text-amber-600" />
                <div>
                  <p className="text-xs font-semibold text-stone-900">
                    Meshy AI Multi-Image to 3D API
                  </p>
                  <p className="text-[11px] text-stone-500">
                    Model: meshy-7.1 / standard • 2K Textures • PBR enabled
                  </p>
                </div>
              </div>
              <Badge variant="secondary">Configured</Badge>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border border-stone-100 bg-stone-50/50">
              <div className="flex items-center gap-3">
                <ShieldCheck className="h-4 w-4 text-stone-600" />
                <div>
                  <p className="text-xs font-semibold text-stone-900">
                    Authentication Engine
                  </p>
                  <p className="text-[11px] text-stone-500">
                    Better Auth (Drizzle PostgreSQL Adapter)
                  </p>
                </div>
              </div>
              <Badge variant="secondary">Enabled</Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
