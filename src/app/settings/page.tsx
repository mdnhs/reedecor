"use client";

import React, { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormSkeleton } from "@/components/ui/skeleton-patterns";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth/auth-context";
import { ShieldCheck, Share2, ExternalLink, Check, Eye, EyeOff, AlertCircle, Store, User, Cpu } from "lucide-react";
import Link from "next/link";
import { useOrigin } from "@/lib/hooks/use-origin";

export default function SettingsPage() {
  const { user, role, isSaasAdmin, refreshUser } = useAuth();
  const origin = useOrigin();

  // Merchant Profile State
  const [businessName, setBusinessName] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [location, setLocation] = useState("");
  const [bio, setBio] = useState("");
  const [savingMerchant, setSavingMerchant] = useState(false);
  const [merchantSavedSuccess, setMerchantSavedSuccess] = useState(false);
  const [merchantError, setMerchantError] = useState<string | null>(null);
  const [copiedStoreLink, setCopiedStoreLink] = useState(false);

  // SaaS Admin Platform Settings (Stored in Supabase DB)
  const [meshyApiKey, setMeshyApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [meshyApiBaseUrl, setMeshyApiBaseUrl] = useState("https://api.meshy.ai");
  const [meshyModel, setMeshyModel] = useState("meshy-7.1");
  const [meshyGeometryResolution, setMeshyGeometryResolution] = useState("standard");
  const [meshyTextureResolution, setMeshyTextureResolution] = useState("2k");
  const [meshyCreditsPerGeneration, setMeshyCreditsPerGeneration] = useState("20");
  const [usdToBdtRate, setUsdToBdtRate] = useState("122.50");
  const [costPerCreditUsd, setCostPerCreditUsd] = useState("0.05");
  const [savingAdminSettings, setSavingAdminSettings] = useState(false);
  const [adminSettingsSaved, setAdminSettingsSaved] = useState(false);
  const [adminSettingsLoaded, setAdminSettingsLoaded] = useState(false);
  const [adminSettingsError, setAdminSettingsError] = useState<string | null>(null);
  const [adminReloadKey, setAdminReloadKey] = useState(0);

  const merchantStoreId = user?.id || "demo-merchant-001";
  const storeUrl = origin ? `${origin}/store/${merchantStoreId}` : `/store/${merchantStoreId}`;

  // Fetch current merchant info
  useEffect(() => {
    let ignore = false;
    async function loadProfile() {
      try {
        const res = await fetch("/api/merchants/profile");
        const json = await res.json();
        if (!ignore && json.success && json.data) {
          if (json.data.businessName) setBusinessName(json.data.businessName);
          if (json.data.name) setContactName(json.data.name);
          if (json.data.email) setContactEmail(json.data.email);
          if (json.data.whatsappNumber) setWhatsappNumber(json.data.whatsappNumber);
          if (json.data.location) setLocation(json.data.location);
          if (json.data.bio) setBio(json.data.bio);
        }
      } catch (e) {
        console.error("Error loading merchant profile in settings:", e);
      }
    }
    loadProfile();
    return () => {
      ignore = true;
    };
  }, [merchantStoreId]);

  // Fetch SaaS Admin System Settings from DB
  useEffect(() => {
    let ignore = false;
    async function loadAdminSettings() {
      if (!isSaasAdmin) return;
      setAdminSettingsError(null);
      try {
        const res = await fetch("/api/admin/settings");
        const json = await res.json();
        if (!ignore && !json.success) setAdminSettingsError(json.error || "Could not load platform settings.");
        if (!ignore && json.success && json.data) {
          if (json.data.meshyApiKey) setMeshyApiKey(json.data.meshyApiKey);
          if (json.data.meshyApiBaseUrl) setMeshyApiBaseUrl(json.data.meshyApiBaseUrl);
          if (json.data.meshyModel) setMeshyModel(json.data.meshyModel);
          if (json.data.meshyGeometryResolution)
            setMeshyGeometryResolution(json.data.meshyGeometryResolution);
          if (json.data.meshyTextureResolution)
            setMeshyTextureResolution(json.data.meshyTextureResolution);
          if (json.data.meshyCreditsPerGeneration)
            setMeshyCreditsPerGeneration(String(json.data.meshyCreditsPerGeneration));
          if (json.data.usdToBdtRate) setUsdToBdtRate(String(json.data.usdToBdtRate));
          if (json.data.costPerCreditUsd)
            setCostPerCreditUsd(String(json.data.costPerCreditUsd));
          setAdminSettingsLoaded(true);
        }
      } catch (err) {
        console.error("Failed to load admin settings:", err);
        if (!ignore) setAdminSettingsError("Could not load platform settings.");
      }
    }
    loadAdminSettings();
    return () => {
      ignore = true;
    };
  }, [isSaasAdmin, adminReloadKey]);

  async function handleSaveMerchantSettings(e: React.FormEvent) {
    e.preventDefault();
    setSavingMerchant(true);
    setMerchantSavedSuccess(false);
    setMerchantError(null);

    try {
      const res = await fetch("/api/merchants/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: contactName,
          businessName,
          whatsappNumber,
          location,
          bio,
          email: contactEmail || undefined,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setMerchantSavedSuccess(true);
        if (refreshUser) refreshUser();
        setTimeout(() => setMerchantSavedSuccess(false), 3500);
      } else {
        setMerchantError(json.error || "Failed to update merchant settings.");
      }
    } catch (err) {
      console.error("Error saving merchant profile:", err);
      setMerchantError("Failed to update merchant settings. Please check connection.");
    } finally {
      setSavingMerchant(false);
    }
  }

  async function handleSaveAdminSettings(e: React.FormEvent) {
    e.preventDefault();
    const creditsPerGeneration = parseInt(meshyCreditsPerGeneration, 10);
    const rate = parseFloat(usdToBdtRate);
    const costPerCredit = parseFloat(costPerCreditUsd);
    if (!(creditsPerGeneration > 0) || !(rate > 0) || !(costPerCredit > 0)) {
      setAdminSettingsError("Credits per generation, exchange rate and cost per credit must all be positive numbers.");
      return;
    }
    setAdminSettingsError(null);
    setSavingAdminSettings(true);
    setAdminSettingsSaved(false);

    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meshyApiKey,
          meshyApiBaseUrl,
          meshyModel,
          meshyGeometryResolution,
          meshyTextureResolution,
          meshyCreditsPerGeneration: creditsPerGeneration,
          usdToBdtRate: rate,
          costPerCreditUsd: costPerCredit,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setAdminSettingsSaved(true);
        setTimeout(() => setAdminSettingsSaved(false), 3500);
      } else {
        setAdminSettingsError(json.error || "Failed to update system settings.");
      }
    } catch (err) {
      console.error("Failed to save admin settings:", err);
      setAdminSettingsError("Error saving settings. Check your connection and try again.");
    } finally {
      setSavingAdminSettings(false);
    }
  }

  function handleCopyStoreLink() {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(storeUrl);
      setCopiedStoreLink(true);
      setTimeout(() => setCopiedStoreLink(false), 2500);
    }
  }

  const selectClass =
    "h-9 w-full rounded-lg border border-stone-200 bg-white px-3 text-sm text-stone-800 shadow-2xs focus:outline-none focus:ring-1 focus:ring-stone-900";

  return (
    <DashboardLayout
      title="Settings"
      subtitle="Store, account, platform"
    >
      <div className="mx-auto max-w-3xl space-y-12 pb-12">
        <form onSubmit={handleSaveMerchantSettings} className="space-y-6">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold text-stone-900">
            <Store className="h-5 w-5 text-amber-600" />
            Store
          </h2>

          <div className="glass-panel studio-card-shadow flex flex-col gap-3 rounded-2xl p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p suppressHydrationWarning className="break-all font-mono text-xs text-stone-600 select-all">
                {storeUrl}
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button type="button" size="sm" variant="outline" onClick={handleCopyStoreLink} className="gap-1.5">
                {copiedStoreLink ? <Check className="h-4 w-4 text-emerald-600" /> : <Share2 className="h-4 w-4" />}
                <span>{copiedStoreLink ? "Copied" : "Copy"}</span>
              </Button>
              <Link href={`/store/${merchantStoreId}`} target="_blank">
                <Button type="button" size="sm" variant="outline" className="gap-1.5">
                  <ExternalLink className="h-4 w-4" />
                  <span>View</span>
                </Button>
              </Link>
            </div>
          </div>

          {merchantError && (
            <div role="alert" className="flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{merchantError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field id="business-name" label="Business">
              <Input
                id="business-name"
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="e.g. Artisan Living Dhaka"
                required
              />
            </Field>
            <Field id="contact-name" label="Owner">
              <Input
                id="contact-name"
                type="text"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="e.g. Luxury Oak Merchant"
                required
              />
            </Field>
            <Field id="whatsapp-number" label="WhatsApp">
              <Input
                id="whatsapp-number"
                type="text"
                value={whatsappNumber}
                onChange={(e) => setWhatsappNumber(e.target.value)}
                placeholder="e.g. 01865818044"
                required
              />
            </Field>
            <Field id="contact-email" label="Email">
              <Input
                id="contact-email"
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="e.g. merchant@artisanstudio.com"
                required
              />
            </Field>
          </div>
          <Field id="location" label="Location" optional>
            <Input
              id="location"
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Gulshan-2, Dhaka, Bangladesh"
            />
          </Field>
          <Field id="bio" label="Bio" optional>
            <Textarea
              id="bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Short tagline"
              className="min-h-20 text-sm"
            />
          </Field>

          <div className="flex items-center justify-end gap-3">
            <span role="status" className="text-sm font-medium text-emerald-700">
              {merchantSavedSuccess && (
                <span className="flex items-center gap-1">
                  <Check className="h-4 w-4" /> Saved
                </span>
              )}
            </span>
            <Button type="submit" disabled={savingMerchant} className="bg-gradient-brand text-white">
              {savingMerchant ? "Saving..." : "Save"}
            </Button>
          </div>
        </form>

        <section className="space-y-4">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold text-stone-900">
            <User className="h-5 w-5 text-amber-600" />
            Account
          </h2>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-stone-100 text-sm font-semibold text-stone-700">
                {user?.name ? user.name.slice(0, 2).toUpperCase() : "U"}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-stone-900">{user?.name || "Merchant"}</p>
                <p className="truncate text-sm text-stone-500">{user?.email || "user@artisanstudio.com"}</p>
              </div>
              <Badge variant="secondary" className="capitalize">
                {role.replace("_", " ")}
              </Badge>
            </div>
            {isSaasAdmin && (
              <Link href="/admin/rbac">
                <Button type="button" size="sm" variant="outline" className="gap-1.5">
                  <ShieldCheck className="h-4 w-4" />
                  <span>Users</span>
                </Button>
              </Link>
            )}
          </div>
        </section>

        {isSaasAdmin && (
          <section className="space-y-6">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold text-stone-900">
              <Cpu className="h-5 w-5 text-amber-600" />
              Platform
            </h2>

            {adminSettingsError && (
              <div role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
                <span className="flex items-center gap-3">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {adminSettingsError}
                </span>
                {!adminSettingsLoaded && (
                  <Button type="button" size="sm" variant="outline" onClick={() => setAdminReloadKey((k) => k + 1)}>
                    Try again
                  </Button>
                )}
              </div>
            )}

            {!adminSettingsLoaded && !adminSettingsError ? (
              <FormSkeleton />
            ) : (
              <form onSubmit={handleSaveAdminSettings} className="space-y-6">
                <Field id="meshy-api-key" label="API key">
                  <div className="relative">
                    <Input
                      id="meshy-api-key"
                      type={showApiKey ? "text" : "password"}
                      value={meshyApiKey}
                      onChange={(e) => setMeshyApiKey(e.target.value)}
                      placeholder="your_meshy_api_key_here"
                      className="pr-10 font-mono"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700"
                      aria-label={showApiKey ? "Hide API key" : "Show API key"}
                    >
                      {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </Field>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field id="meshy-base-url" label="Base URL">
                    <Input
                      id="meshy-base-url"
                      type="url"
                      value={meshyApiBaseUrl}
                      onChange={(e) => setMeshyApiBaseUrl(e.target.value)}
                      placeholder="https://api.meshy.ai"
                      required
                    />
                  </Field>
                  <Field id="meshy-model" label="Model">
                    <Input
                      id="meshy-model"
                      type="text"
                      value={meshyModel}
                      onChange={(e) => setMeshyModel(e.target.value)}
                      placeholder="meshy-7.1"
                      required
                    />
                  </Field>
                  <Field id="meshy-geometry" label="Geometry">
                    <select
                      id="meshy-geometry"
                      value={meshyGeometryResolution}
                      onChange={(e) => setMeshyGeometryResolution(e.target.value)}
                      className={selectClass}
                    >
                      <option value="standard">Standard</option>
                      <option value="high_poly">High poly</option>
                    </select>
                  </Field>
                  <Field id="meshy-texture" label="Texture">
                    <select
                      id="meshy-texture"
                      value={meshyTextureResolution}
                      onChange={(e) => setMeshyTextureResolution(e.target.value)}
                      className={selectClass}
                    >
                      <option value="1k">1k</option>
                      <option value="2k">2k</option>
                      <option value="4k">4k</option>
                    </select>
                  </Field>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <Field id="credits-per-generation" label="Credits / model">
                    <Input
                      id="credits-per-generation"
                      type="number"
                      min="1"
                      value={meshyCreditsPerGeneration}
                      onChange={(e) => setMeshyCreditsPerGeneration(e.target.value)}
                      required
                    />
                  </Field>
                  <Field id="usd-to-bdt" label="BDT / USD">
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-stone-500">৳</span>
                      <Input
                        id="usd-to-bdt"
                        type="number"
                        step="0.01"
                        min="1"
                        value={usdToBdtRate}
                        onChange={(e) => setUsdToBdtRate(e.target.value)}
                        className="pl-7"
                        required
                      />
                    </div>
                  </Field>
                  <Field id="cost-per-credit" label="USD / credit">
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-stone-500">$</span>
                      <Input
                        id="cost-per-credit"
                        type="number"
                        step="0.001"
                        min="0.001"
                        value={costPerCreditUsd}
                        onChange={(e) => setCostPerCreditUsd(e.target.value)}
                        className="pl-7"
                        required
                      />
                    </div>
                  </Field>
                </div>

                <div className="flex items-center justify-end gap-3">
                  <span role="status" className="text-sm font-medium text-emerald-700">
                    {adminSettingsSaved && (
                      <span className="flex items-center gap-1">
                        <Check className="h-4 w-4" /> Saved
                      </span>
                    )}
                  </span>
                  <Button
                    type="submit"
                    disabled={savingAdminSettings || !adminSettingsLoaded}
                    className="bg-gradient-brand text-white"
                  >
                    {savingAdminSettings ? "Saving..." : "Save"}
                  </Button>
                </div>
              </form>
            )}
          </section>
        )}
      </div>
    </DashboardLayout>
  );
}

function Field({
  id,
  label,
  optional,
  children,
}: {
  id: string;
  label: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium text-stone-700">
        {label}
        {optional && <span className="ml-1 font-normal text-stone-400">(optional)</span>}
      </label>
      {children}
    </div>
  );
}
