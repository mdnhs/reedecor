"use client";

import React from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth/auth-context";
import { Database, HardDrive, Cpu, ShieldCheck, UserCheck } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function SettingsPage() {
  const { user, role, isSaasAdmin } = useAuth();

  return (
    <DashboardLayout
      title="Studio Settings"
      subtitle="View your merchant profile, integration statuses, and environment configuration"
    >
      <div className="max-w-4xl space-y-6">
        {/* User Profile Card */}
        <Card className="border-stone-200/80 bg-white">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold text-stone-900">
                  User Session Profile
                </CardTitle>
                <CardDescription className="text-xs">
                  Active authentication credentials and RBAC access tier
                </CardDescription>
              </div>
              {isSaasAdmin && (
                <Link href="/admin/rbac">
                  <Button size="sm" variant="outline" className="gap-1.5 text-xs">
                    <ShieldCheck className="h-3.5 w-3.5 text-amber-600" />
                    <span>Manage All Users (RBAC)</span>
                  </Button>
                </Link>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <div
                className={`h-12 w-12 rounded-full flex items-center justify-center font-bold text-sm ${
                  role === "saas_admin"
                    ? "bg-amber-100 text-amber-900 border border-amber-300"
                    : role === "merchant"
                    ? "bg-stone-900 text-stone-50"
                    : "bg-stone-200 text-stone-700"
                }`}
              >
                {user?.name ? user.name.slice(0, 2).toUpperCase() : "U"}
              </div>
              <div>
                <h4 className="font-semibold text-stone-900 text-sm">
                  {user?.name || "Merchant"}
                </h4>
                <p className="text-xs text-stone-500 font-mono">{user?.email || "user@artisanstudio.com"}</p>
                <div className="mt-1.5 flex items-center gap-2">
                  <Badge
                    variant={
                      role === "saas_admin"
                        ? "destructive"
                        : role === "merchant"
                        ? "processing"
                        : "secondary"
                    }
                    className="text-[10px] uppercase font-bold"
                  >
                    Role: {role.replace("_", " ")}
                  </Badge>
                  <span className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
                    <UserCheck className="h-3 w-3" /> Active Session
                  </span>
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
                    Supabase Cloud Database (via Supabase JS SDK)
                  </p>
                  <p className="text-[11px] text-stone-500">
                    Project Ref: aafouqxsgibfqjcxozii • Direct REST/RPC Query Engine
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
                    Merchant Authentication
                  </p>
                  <p className="text-[11px] text-stone-500">
                    Demo Merchant Profile & Role-Based Access
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
