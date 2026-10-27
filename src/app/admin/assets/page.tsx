"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, Lock } from "lucide-react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ProductGridSkeleton } from "@/components/ui/skeleton-patterns";
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
      <DashboardLayout title="Room Assets" >
        <Card className="mx-auto my-12 max-w-md space-y-4 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-stone-100 text-stone-600">
            <Lock className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="space-y-1">
            <h2 className="font-display text-lg font-bold text-stone-900">Admins only</h2>
            <p className="text-sm text-stone-500">
              You are signed in as <strong>{user?.name || "User"}</strong>.
            </p>
          </div>
          {demoMode && (
            <Button onClick={() => switchDemoRole("saas_admin")} className="bg-gradient-brand text-white">
              Switch to admin
            </Button>
          )}
        </Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="Room Assets"
    >
      <div className="max-w-6xl space-y-8">
        {error && (
          <div role="alert" className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
            {error}
          </div>
        )}

        <CategoryManager categories={categories} onChanged={load} onError={setError} />
        <AssetUploadForm categories={categories} merchants={merchants} onCreated={load} onError={setError} />

        <section className="space-y-3">
          <h2 className="font-display text-lg font-bold text-stone-900">
            Uploaded assets{!loading && assets.length > 0 ? ` (${assets.length})` : ""}
          </h2>
          {loading ? (
            <ProductGridSkeleton count={3} />
          ) : assets.length === 0 ? (
            <p className="rounded-xl border border-dashed border-stone-200 py-12 text-center text-sm text-stone-500">
              No assets yet.
            </p>
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
        </section>
      </div>
    </DashboardLayout>
  );
}
