"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, Lock } from "lucide-react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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
      <DashboardLayout title="Features — Access Denied" subtitle="SaaS Admin privilege required to manage features">
        <Card className="mx-auto my-12 max-w-lg space-y-5 border-rose-200 bg-rose-50/40 p-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-100 text-rose-600">
            <Lock className="h-7 w-7" />
          </div>
          <div className="space-y-2">
            <Badge variant="destructive" className="text-xs">
              SaaS Admin Privilege Required
            </Badge>
            <p className="text-xs text-stone-600">
              You are signed in as <strong>{user?.name || "User"}</strong>. Only SaaS Administrators can switch features on or off.
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
    <DashboardLayout title="Features" subtitle="Switch platform features on or off for everyone. Turning a feature off never deletes data.">
      <div className="max-w-4xl space-y-6">
        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {loading ? (
          <Skeleton className="h-64 w-full" />
        ) : (
          GROUP_ORDER.map((group) => {
            const items = features.filter((f) => f.group === group);
            if (items.length === 0) return null;
            return (
              <Card key={group}>
                <CardHeader>
                  <CardTitle className="text-sm">{group}</CardTitle>
                  <CardDescription className="text-xs">
                    {items.filter((f) => f.enabled).length} of {items.length} on
                  </CardDescription>
                </CardHeader>
                <CardContent className="divide-y divide-stone-100">
                  {items.map((feature) => (
                    <div key={feature.key} className="flex items-center justify-between gap-4 py-3">
                      <div className="space-y-0.5">
                        <p className="text-sm font-semibold text-stone-900">{feature.label}</p>
                        <p className="text-xs text-stone-500">{feature.description}</p>
                        {feature.updatedAt && (
                          <p className="text-xs text-stone-400">
                            Last changed {new Date(feature.updatedAt).toLocaleString()}
                            {feature.updatedBy ? ` by ${feature.updatedBy}` : ""}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={feature.enabled}
                        aria-label={feature.label}
                        disabled={saving === feature.key}
                        onClick={() => toggle(feature)}
                        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-60 ${
                          feature.enabled ? "bg-stone-900" : "bg-stone-300"
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${
                            feature.enabled ? "left-5.5" : "left-0.5"
                          }`}
                        />
                      </button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </DashboardLayout>
  );
}
