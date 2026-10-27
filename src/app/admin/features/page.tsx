"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, Lock } from "lucide-react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TableSkeleton } from "@/components/ui/skeleton-patterns";
import { useAuth } from "@/lib/auth/auth-context";
import { useFeatures } from "@/lib/features/features-context";
import type { FeatureDefinition, FeatureGroup } from "@/lib/features/catalog";
import { assetFetch, errorText } from "@/components/assets/api";

interface FeatureEntry extends FeatureDefinition {
  enabled: boolean;
  updatedAt: string | null;
  updatedBy: string | null;
}

const GROUP_ORDER: FeatureGroup[] = ["Models", "Room studio", "Viewer", "Shopping"];

export default function AdminFeaturesPage() {
  const { user, isSaasAdmin, isLoading: authLoading, demoMode, switchDemoRole } = useAuth();
  const { refresh } = useFeatures();
  const [features, setFeatures] = useState<FeatureEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    async function load() {
      if (!isSaasAdmin) return;
      try {
        const data = await assetFetch<FeatureEntry[]>("/api/admin/features");
        if (!ignore) {
          setFeatures(data);
          setError(null);
        }
      } catch (err) {
        if (!ignore) setError(errorText(err));
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    load();
    return () => {
      ignore = true;
    };
  }, [isSaasAdmin]);

  const toggle = useCallback(
    async (feature: FeatureEntry) => {
      setSaving(feature.key);
      setError(null);
      try {
        const updated = await assetFetch<FeatureEntry>(`/api/admin/features/${feature.key}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enabled: !feature.enabled }),
        });
        setFeatures((prev) => prev.map((f) => (f.key === updated.key ? updated : f)));
        await refresh();
      } catch (err) {
        setError(errorText(err));
      } finally {
        setSaving(null);
      }
    },
    [refresh]
  );

  if (authLoading) {
    return (
      <DashboardLayout title="Features">
        <Skeleton className="h-64 w-full rounded-2xl" />
      </DashboardLayout>
    );
  }

  if (!isSaasAdmin) {
    return (
      <DashboardLayout title="Features" >
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
    <DashboardLayout title="Features" >
      <div className="max-w-3xl space-y-8">
        {error && (
          <div role="alert" className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
            {error}
          </div>
        )}

        {loading ? (
          <TableSkeleton rows={6} />
        ) : features.length === 0 ? (
          <p className="rounded-xl border border-dashed border-stone-200 py-12 text-center text-sm text-stone-500">
            No features yet.
          </p>
        ) : (
          GROUP_ORDER.map((group) => {
            const items = features.filter((f) => f.group === group);
            if (items.length === 0) return null;
            return (
              <section key={group} className="space-y-3">
                <div className="flex items-baseline justify-between gap-2">
                  <h2 className="font-display text-lg font-bold text-stone-900">{group}</h2>
                  <span className="text-xs text-stone-500">
                    {items.filter((f) => f.enabled).length} of {items.length} on
                  </span>
                </div>
                <Card className="divide-y divide-stone-100 p-0">
                  {items.map((feature) => (
                    <div key={feature.key} className="flex items-center justify-between gap-4 px-4 py-3">
                      <div className="min-w-0 space-y-0.5">
                        <p className="text-sm font-semibold text-stone-900">{feature.label}</p>
                        <p className="text-sm text-stone-500">{feature.description}</p>
                        {feature.updatedAt && (
                          <p className="text-xs text-stone-500">
                            Last changed {new Date(feature.updatedAt).toLocaleString()}
                            {feature.updatedBy ? ` by ${feature.updatedBy}` : ""}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <span className="w-6 text-right text-xs font-medium text-stone-500" aria-hidden="true">
                          {feature.enabled ? "On" : "Off"}
                        </span>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={feature.enabled}
                          aria-label={feature.label}
                          disabled={saving === feature.key}
                          onClick={() => toggle(feature)}
                          className={`relative h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 focus-visible:ring-offset-2 disabled:opacity-60 ${
                            feature.enabled ? "bg-amber-600" : "bg-stone-300"
                          }`}
                        >
                          <span
                            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${
                              feature.enabled ? "left-5.5" : "left-0.5"
                            }`}
                          />
                        </button>
                      </div>
                    </div>
                  ))}
                </Card>
              </section>
            );
          })
        )}
      </div>
    </DashboardLayout>
  );
}
