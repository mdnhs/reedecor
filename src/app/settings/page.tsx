"use client";

import React, { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth/auth-context";
import {
  Database,
  HardDrive,
  Cpu,
  ShieldCheck,
  UserCheck,
  MessageCircle,
  Share2,
  ExternalLink,
  Check,
  Store,
  Sparkles,
  Eye,
  EyeOff,
  Sliders,
  DollarSign,
} from "lucide-react";
import Link from "next/link";
import { useOrigin } from "@/lib/hooks/use-origin";

export default function SettingsPage() {
  const { user, role, isSaasAdmin } = useAuth();
  const origin = useOrigin();

  // Merchant Profile State
  const [businessName, setBusinessName] = useState("Artisan Living Studio");
  const [whatsappNumber, setWhatsappNumber] = useState("01865818044");
  const [location, setLocation] = useState("Gulshan-2, Dhaka, Bangladesh");
  const [bio, setBio] = useState(
    "Luxury architectural handcrafted 3D custom furniture. Made to order with premium Burmese teak and seasoned oak."
  );
  const [savingMerchant, setSavingMerchant] = useState(false);
  const [merchantSavedSuccess, setMerchantSavedSuccess] = useState(false);
  const [copiedStoreLink, setCopiedStoreLink] = useState(false);

  // SaaS Admin Platform Settings (Stored in Supabase DB)
  const [meshyApiKey, setMeshyApiKey] = useState("your_meshy_api_key_here");
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

  const merchantStoreId = user?.id || "demo-merchant-001";
  const storeUrl = origin ? `${origin}/store/${merchantStoreId}` : `/store/${merchantStoreId}`;

  // Fetch current merchant info
  useEffect(() => {
    let ignore = false;
    async function loadProfile() {
      try {
        const res = await fetch(`/api/merchants/${merchantStoreId}/public`);
        const json = await res.json();
        if (!ignore && json.success && json.data) {
          if (json.data.businessName) setBusinessName(json.data.businessName);
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
      try {
        const res = await fetch("/api/admin/settings");
        const json = await res.json();
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
        }
      } catch (err) {
        console.error("Failed to load admin settings:", err);
      }
    }
    loadAdminSettings();
    return () => {
      ignore = true;
    };
  }, [isSaasAdmin]);

  async function handleSaveMerchantSettings(e: React.FormEvent) {
    e.preventDefault();
    setSavingMerchant(true);
    setMerchantSavedSuccess(false);

    try {
      const res = await fetch("/api/merchants/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName,
          whatsappNumber,
          location,
          bio,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setMerchantSavedSuccess(true);
        setTimeout(() => setMerchantSavedSuccess(false), 3000);
      }
    } catch (err) {
      console.error("Error saving merchant profile:", err);
    } finally {
      setSavingMerchant(false);
    }
  }

  async function handleSaveAdminSettings(e: React.FormEvent) {
    e.preventDefault();
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
          meshyCreditsPerGeneration: parseInt(meshyCreditsPerGeneration, 10) || 20,
          usdToBdtRate: parseFloat(usdToBdtRate) || 122.5,
          costPerCreditUsd: parseFloat(costPerCreditUsd) || 0.05,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setAdminSettingsSaved(true);
        setTimeout(() => setAdminSettingsSaved(false), 3500);
      } else {
        alert(json.error || "Failed to update system settings in DB");
      }
    } catch (err) {
      console.error("Failed to save admin settings:", err);
      alert("Error saving settings to database.");
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

  return (
    <DashboardLayout
      title="Studio & Platform Settings"
      subtitle="Manage merchant storefront, WhatsApp contact, and SaaS platform configurations"
    >
      <div className="max-w-4xl space-y-6">
        {/* ================================================================= */}
        {/* 1. SaaS Admin Platform Configuration (Database Stored)           */}
        {/* ================================================================= */}
        {isSaasAdmin ? (
          <Card className="border-amber-200/90 bg-white shadow-xs overflow-hidden">
            <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent px-6 py-4 border-b border-amber-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-amber-700 text-white flex items-center justify-center shadow-xs">
                  <Sliders className="h-4 w-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-sm font-bold text-stone-900">
                      SaaS Admin Platform Configuration (Database Stored)
                    </CardTitle>
                    <Badge className="bg-amber-100 text-amber-900 border-amber-300 text-[10px] font-bold">
                      Supabase DB Live
                    </Badge>
                  </div>
                  <CardDescription className="text-xs text-stone-600 mt-0.5">
                    Configure Meshy AI keys, model settings, and economics rates stored in PostgreSQL
                  </CardDescription>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Badge variant="success" className="gap-1 text-[10px]">
                  <Database className="w-3 h-3" />
                  <span>public.system_settings</span>
                </Badge>
              </div>
            </div>

            <CardContent className="p-6">
              <form onSubmit={handleSaveAdminSettings} className="space-y-6">
                {/* Section A: Meshy AI Multi-Image API Settings */}
                <div className="space-y-3.5">
                  <div className="flex items-center gap-2 pb-1 border-b border-stone-100">
                    <Cpu className="h-4 w-4 text-amber-700" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-stone-800">
                      Meshy AI Multi-Image to 3D API
                    </h4>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-stone-700 flex items-center justify-between">
                      <span>MESHY_API_KEY <span className="text-rose-500">*</span></span>
                      <span className="text-[10px] text-stone-400 font-mono">Secret Key for 3D generation</span>
                    </label>
                    <div className="relative">
                      <Input
                        type={showApiKey ? "text" : "password"}
                        value={meshyApiKey}
                        onChange={(e) => setMeshyApiKey(e.target.value)}
                        placeholder="your_meshy_api_key_here"
                        className="h-9 text-xs font-mono pr-10 bg-stone-50/50"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowApiKey(!showApiKey)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700"
                        title={showApiKey ? "Hide Key" : "Show Key"}
                      >
                        {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-stone-700">
                        MESHY_API_BASE_URL
                      </label>
                      <Input
                        type="url"
                        value={meshyApiBaseUrl}
                        onChange={(e) => setMeshyApiBaseUrl(e.target.value)}
                        placeholder="https://api.meshy.ai"
                        className="h-9 text-xs font-mono"
                        required
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-stone-700">
                        MESHY_MODEL
                      </label>
                      <Input
                        type="text"
                        value={meshyModel}
                        onChange={(e) => setMeshyModel(e.target.value)}
                        placeholder="meshy-7.1"
                        className="h-9 text-xs font-mono"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-stone-700">
                        GEOMETRY_RESOLUTION
                      </label>
                      <select
                        value={meshyGeometryResolution}
                        onChange={(e) => setMeshyGeometryResolution(e.target.value)}
                        className="w-full h-9 px-3 rounded-lg border border-stone-200 bg-white text-xs font-medium text-stone-800 focus:outline-hidden focus:ring-1 focus:ring-stone-900"
                      >
                        <option value="standard">standard (Optimized WebGL)</option>
                        <option value="high_poly">high_poly (Ultra Details)</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-stone-700">
                        TEXTURE_RESOLUTION
                      </label>
                      <select
                        value={meshyTextureResolution}
                        onChange={(e) => setMeshyTextureResolution(e.target.value)}
                        className="w-full h-9 px-3 rounded-lg border border-stone-200 bg-white text-xs font-medium text-stone-800 focus:outline-hidden focus:ring-1 focus:ring-stone-900"
                      >
                        <option value="1k">1k (Fast Preview)</option>
                        <option value="2k">2k (Standard PBR)</option>
                        <option value="4k">4k (Ultra High Res)</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-stone-700">
                        CREDITS_PER_GENERATION
                      </label>
                      <Input
                        type="number"
                        min="1"
                        value={meshyCreditsPerGeneration}
                        onChange={(e) => setMeshyCreditsPerGeneration(e.target.value)}
                        className="h-9 text-xs font-mono"
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* Section B: Economics & Currency Rates */}
                <div className="space-y-3.5 pt-2">
                  <div className="flex items-center gap-2 pb-1 border-b border-stone-100">
                    <DollarSign className="h-4 w-4 text-emerald-700" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-stone-800">
                      Economics & Currency Rates
                    </h4>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-stone-700 flex items-center justify-between">
                        <span>USD_TO_BDT_RATE</span>
                        <span className="text-[10px] text-stone-400 font-normal">BDT per 1 USD</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-stone-500">
                          ৳
                        </span>
                        <Input
                          type="number"
                          step="0.01"
                          min="1"
                          value={usdToBdtRate}
                          onChange={(e) => setUsdToBdtRate(e.target.value)}
                          className="h-9 text-xs font-mono font-bold pl-7"
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-stone-700 flex items-center justify-between">
                        <span>COST_PER_CREDIT_USD</span>
                        <span className="text-[10px] text-stone-400 font-normal">USD cost per 1 credit</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-stone-500">
                          $
                        </span>
                        <Input
                          type="number"
                          step="0.001"
                          min="0.001"
                          value={costPerCreditUsd}
                          onChange={(e) => setCostPerCreditUsd(e.target.value)}
                          className="h-9 text-xs font-mono font-bold pl-7"
                          required
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Submit Actions */}
                <div className="flex items-center justify-between pt-4 border-t border-stone-100">
                  <div className="text-[11px] text-stone-500 flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5 text-amber-700" />
                    <span>Values are written directly to PostgreSQL and take effect immediately.</span>
                  </div>

                  <div className="flex items-center gap-3">
                    {adminSettingsSaved && (
                      <span className="text-xs text-emerald-700 font-semibold flex items-center gap-1 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                        <Check className="w-3.5 h-3.5 text-emerald-600" /> Settings saved to Database!
                      </span>
                    )}

                    <Button
                      type="submit"
                      disabled={savingAdminSettings}
                      className="bg-amber-700 hover:bg-amber-800 text-white text-xs h-9 px-5 shadow-xs font-semibold"
                    >
                      {savingAdminSettings ? "Saving to DB..." : "Save Platform Configuration"}
                    </Button>
                  </div>
                </div>
              </form>
            </CardContent>
          </Card>
        ) : null}

        {/* ================================================================= */}
        {/* 2. Merchant Public Profile & WhatsApp Settings                    */}
        {/* ================================================================= */}
        <Card className="border-stone-200/80 bg-white">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <Store className="w-4 h-4 text-amber-700" />
                  <CardTitle className="text-sm font-semibold text-stone-900">
                    Merchant Public Profile & WhatsApp Integration
                  </CardTitle>
                </div>
                <CardDescription className="text-xs mt-1">
                  Share your 3D furniture showcase with customers and receive direct WhatsApp purchase orders
                </CardDescription>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCopyStoreLink}
                  className="h-8 gap-1.5 text-xs border-stone-300 text-stone-700"
                >
                  {copiedStoreLink ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-700 font-medium">Link Copied!</span>
                    </>
                  ) : (
                    <>
                      <Share2 className="w-3.5 h-3.5" />
                      <span>Share Storefront Link</span>
                    </>
                  )}
                </Button>

                <Link href={`/store/${merchantStoreId}`} target="_blank">
                  <Button size="sm" className="h-8 gap-1.5 text-xs bg-stone-900 text-white hover:bg-stone-800">
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>View Public Store</span>
                  </Button>
                </Link>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSaveMerchantSettings} className="space-y-4">
              <div className="p-3 bg-amber-50/70 border border-amber-200/60 rounded-xl text-xs text-amber-900 flex items-start gap-2.5">
                <Sparkles className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Public Shareable Link:</p>
                  <p
                    suppressHydrationWarning
                    className="font-mono text-[11px] text-amber-800 break-all select-all mt-0.5"
                  >
                    {storeUrl}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-stone-700">Business / Studio Name</label>
                  <Input
                    type="text"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="e.g. Artisan Living Dhaka"
                    className="h-9 text-xs"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-stone-700 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <MessageCircle className="w-3.5 h-3.5 text-[#25D366]" />
                      Merchant WhatsApp Number
                    </span>
                    <span className="text-[10px] text-stone-400 font-normal">With country code</span>
                  </label>
                  <Input
                    type="text"
                    value={whatsappNumber}
                    onChange={(e) => setWhatsappNumber(e.target.value)}
                    placeholder="e.g. 01865818044"
                    className="h-9 text-xs font-mono"
                    required
                  />
                  <p className="text-[11px] text-stone-500">
                    Customers clicking &ldquo;Order on WhatsApp&rdquo; will send specific product name, price, and 3D link directly to this number.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-stone-700">Studio / Showroom Location</label>
                  <Input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="e.g. Gulshan-2, Dhaka, Bangladesh"
                    className="h-9 text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-stone-700">Storefront Bio / Tagline</label>
                  <Textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Brief description of your woodworking craftsmanship..."
                    className="text-xs min-h-[72px]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-stone-100">
                {merchantSavedSuccess && (
                  <span className="text-xs text-emerald-700 font-medium flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" /> Changes saved to Supabase!
                  </span>
                )}
                <Button
                  type="submit"
                  size="sm"
                  disabled={savingMerchant}
                  className="bg-amber-700 hover:bg-amber-800 text-white text-xs h-9 px-4"
                >
                  {savingMerchant ? "Saving Profile..." : "Save Merchant Settings"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* ================================================================= */}
        {/* 3. User Session Profile Card                                      */}
        {/* ================================================================= */}
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

        {/* ================================================================= */}
        {/* 4. Integration & Provider Statuses                                */}
        {/* ================================================================= */}
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
                    Supabase Cloud Database (public.system_settings & tables)
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
                    Meshy AI Multi-Image to 3D API (Dynamic DB Config)
                  </p>
                  <p className="text-[11px] text-stone-500">
                    Model: {meshyModel} • {meshyTextureResolution.toUpperCase()} Texture • {meshyCreditsPerGeneration} Credits/Gen
                  </p>
                </div>
              </div>
              <Badge variant="secondary">Configured in DB</Badge>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border border-stone-100 bg-stone-50/50">
              <div className="flex items-center gap-3">
                <ShieldCheck className="h-4 w-4 text-stone-600" />
                <div>
                  <p className="text-xs font-semibold text-stone-900">
                    Merchant Authentication & RBAC
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
