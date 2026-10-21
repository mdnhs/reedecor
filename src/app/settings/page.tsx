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
} from "lucide-react";
import Link from "next/link";

export default function SettingsPage() {
  const { user, role, isSaasAdmin } = useAuth();

  const [businessName, setBusinessName] = useState("Artisan Living Studio");
  const [whatsappNumber, setWhatsappNumber] = useState("+8801712345678");
  const [location, setLocation] = useState("Gulshan-2, Dhaka, Bangladesh");
  const [bio, setBio] = useState(
    "Luxury architectural handcrafted 3D custom furniture. Made to order with premium Burmese teak and seasoned oak."
  );
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [copiedStoreLink, setCopiedStoreLink] = useState(false);

  const merchantStoreId = user?.id || "demo-merchant-001";
  const storeUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/store/${merchantStoreId}`
      : `/store/${merchantStoreId}`;

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

  async function handleSaveMerchantSettings(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSavedSuccess(false);

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
        setSavedSuccess(true);
        setTimeout(() => setSavedSuccess(false), 3000);
      }
    } catch (err) {
      console.error("Error saving merchant profile:", err);
    } finally {
      setSaving(false);
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
      title="Studio Settings"
      subtitle="Configure your merchant storefront, WhatsApp contact number, and integration settings"
    >
      <div className="max-w-4xl space-y-6">
        {/* Merchant Public Profile & WhatsApp Settings */}
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
                  <p className="font-mono text-[11px] text-amber-800 break-all select-all mt-0.5">
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
                    placeholder="e.g. +8801712345678"
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
                {savedSuccess && (
                  <span className="text-xs text-emerald-700 font-medium flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" /> Changes saved to Supabase!
                  </span>
                )}
                <Button
                  type="submit"
                  size="sm"
                  disabled={saving}
                  className="bg-amber-700 hover:bg-amber-800 text-white text-xs h-9 px-4"
                >
                  {saving ? "Saving Profile..." : "Save Merchant Settings"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

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
