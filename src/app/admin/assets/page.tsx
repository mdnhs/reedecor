"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, Lock } from "lucide-react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth/auth-context";
import type { AssetCategory, RoomAsset } from "@/lib/assets/types";
import { assetFetch, errorText, type MerchantOption } from "@/components/assets/api";
import { AssetCard } from "@/components/assets/asset-card";
import { AssetUploadForm } from "@/components/assets/asset-upload-form";
import { CategoryManager } from "@/components/assets/category-manager";

interface AdminUserRow {
  id: string;
  name: string;
  role: string;
}

export default function AdminAssetsPage() {
  const { user, isSaasAdmin, isLoading: authLoading, demoMode, switchDemoRole } = useAuth();
  const [assets, setAssets] = useState<RoomAsset[]>([]);
  const [categories, setCategories] = useState<AssetCategory[]>([]);
  const [merchants, setMerchants] = useState<MerchantOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    const [assetList, categoryList, users] = await Promise.all([
      assetFetch<RoomAsset[]>("/api/admin/assets"),
      assetFetch<AssetCategory[]>("/api/admin/asset-categories"),
      assetFetch<AdminUserRow[]>("/api/admin/users"),
    ]);
    return {
      assetList,
      categoryList,
      merchantList: users
        .filter((u) => u.role === "merchant")
        .map((u) => ({ id: u.id, name: u.name })),
    };
  }, []);

  const apply = useCallback((data: Awaited<ReturnType<typeof fetchAll>>) => {
    setAssets(data.assetList);
    setCategories(data.categoryList);
    setMerchants(data.merchantList);
    setError(null);
  }, []);

  const load = useCallback(async () => {
    try {
      apply(await fetchAll());
    } catch (err) {
      setError(errorText(err));
    }
  }, [apply, fetchAll]);

  useEffect(() => {
    let ignore = false;
    async function loadInitial() {
      if (!isSaasAdmin) return;
      try {
        const data = await fetchAll();
        if (!ignore) apply(data);
      } catch (err) {
        if (!ignore) setError(errorText(err));
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    loadInitial();
    return () => {
      ignore = true;
    };
  }, [isSaasAdmin, fetchAll, apply]);

  if (authLoading) {
    return (
      <DashboardLayout title="Room Assets">
        <Skeleton className="h-64 w-full rounded-2xl" />
      </DashboardLayout>
    );
  }

  if (!isSaasAdmin) {
    return (
      <DashboardLayout
        title="Room Assets — Access Denied"
        subtitle="SaaS Admin privilege required to manage room assets"
      >
        <Card className="mx-auto my-12 max-w-lg space-y-5 border-rose-200 bg-rose-50/40 p-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-100 text-rose-600">
            <Lock className="h-7 w-7" />
          </div>
          <div className="space-y-2">
            <Badge variant="destructive" className="text-xs">
              SaaS Admin Privilege Required
            </Badge>
            <p className="text-xs text-stone-600">
              You are signed in as <strong>{user?.name || "User"}</strong>. Only SaaS Administrators can manage room assets.
            </p>
          </div>
          {demoMode && (
            <Button onClick={() => switchDemoRole("saas_admin")} className="bg-stone-900 text-white hover:bg-stone-800">
              Switch to SaaS Admin Account
            </Button>
          )}
        </Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="Room Assets"
      subtitle="Upload 3D decoration assets and control which merchants can use them"
    >
      <div className="max-w-6xl space-y-6">
        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <CategoryManager categories={categories} onChanged={load} onError={setError} />
        <AssetUploadForm categories={categories} merchants={merchants} onCreated={load} onError={setError} />

        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-64 w-full" />
            ))}
          </div>
        ) : assets.length === 0 ? (
          <p className="py-8 text-center text-xs text-stone-400">No assets uploaded yet.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {assets.map((asset) => (
              <AssetCard
                key={asset.id}
                asset={asset}
                categories={categories}
                merchants={merchants}
                onChanged={load}
                onError={setError}
              />
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
