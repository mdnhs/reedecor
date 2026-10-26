"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, ShieldCheck, Store, ShoppingBag, ArrowRight } from "lucide-react";
import Link from "next/link";
import { safeNextPath } from "@/lib/auth/route-guard";

export default function LoginPage() {
  const router = useRouter();
  const { login, register, switchDemoRole, demoMode } = useAuth();

  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [selectedRole, setSelectedRole] = useState<"merchant" | "customer">("merchant");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    if (mode === "login") {
      const res = await login(email, password);
      if (res.success) {
        router.push(safeNextPath(new URLSearchParams(window.location.search).get("next")));
      } else {
        setErrorMsg(res.error || "Login failed");
      }
    } else {
      const res = await register(name, email, password, selectedRole);
      if (res.success) {
        router.push(safeNextPath(new URLSearchParams(window.location.search).get("next")));
      } else {
        setErrorMsg(res.error || "Registration failed");
      }
    }
    setLoading(false);
  };

  const handleQuickDemo = async (role: "saas_admin" | "merchant" | "customer") => {
    setLoading(true);
    setErrorMsg(null);
    const switched = await switchDemoRole(role);
    setLoading(false);
    if (!switched) {
      setErrorMsg("Could not switch to the demo account.");
      return;
    }
    if (role === "saas_admin") {
      router.push("/admin/rbac");
    } else {
      router.push("/");
    }
  };

  return (
    <div className="min-h-screen bg-[hsl(var(--background))] flex flex-col justify-center items-center p-4 sm:p-8">
      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <Link href="/" className="inline-flex items-center gap-2 group">
            <div className="h-10 w-10 rounded-xl bg-stone-900 text-stone-50 flex items-center justify-center font-bold font-display shadow-sm group-hover:scale-105 transition-transform">
              <Sparkles className="h-5 w-5 text-amber-400" />
            </div>
            <span className="font-bold text-xl text-stone-900 tracking-tight font-display">
              Artisan 3D
            </span>
          </Link>
          <p className="text-xs text-stone-500">
            Multi-Angle AI 3D Generation & RBAC Access Platform
          </p>
        </div>

        {demoMode && (
        <Card className="border-amber-200/90 bg-amber-50/50 shadow-xs">
          <CardHeader className="pb-2 pt-4 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs uppercase tracking-wider font-bold text-amber-900">
                1-Click Persona Login
              </CardTitle>
              <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-800">
                Instant RBAC Demo
              </Badge>
            </div>
            <CardDescription className="text-xs text-amber-800/80">
              Select any role to test its specific permissions:
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-1 space-y-2">
            <button
              type="button"
              onClick={() => handleQuickDemo("saas_admin")}
              disabled={loading}
              className="w-full flex items-center justify-between p-2.5 rounded-lg border border-amber-200/90 bg-white hover:bg-stone-50 text-left transition-colors shadow-2xs group"
            >
              <div className="flex items-center gap-2.5">
                <div className="h-7 w-7 rounded-md bg-stone-900 text-amber-400 flex items-center justify-center shrink-0">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-stone-900">SaaS Admin (Superuser)</p>
                  <p className="text-xs text-stone-500">RBAC Management, User Roles, Global Audit</p>
                </div>
              </div>
              <ArrowRight className="h-3.5 w-3.5 text-stone-400 group-hover:translate-x-0.5 transition-transform" />
            </button>

            <button
              type="button"
              onClick={() => handleQuickDemo("merchant")}
              disabled={loading}
              className="w-full flex items-center justify-between p-2.5 rounded-lg border border-stone-200 bg-white hover:bg-stone-50 text-left transition-colors shadow-2xs group"
            >
              <div className="flex items-center gap-2.5">
                <div className="h-7 w-7 rounded-md bg-amber-500 text-white flex items-center justify-center shrink-0">
                  <Store className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-stone-900">Furniture Merchant</p>
                  <p className="text-xs text-stone-500">Upload 4-Angles, Generate 3D, Download GLB</p>
                </div>
              </div>
              <ArrowRight className="h-3.5 w-3.5 text-stone-400 group-hover:translate-x-0.5 transition-transform" />
            </button>

            <button
              type="button"
              onClick={() => handleQuickDemo("customer")}
              disabled={loading}
              className="w-full flex items-center justify-between p-2.5 rounded-lg border border-stone-200 bg-white hover:bg-stone-50 text-left transition-colors shadow-2xs group"
            >
              <div className="flex items-center gap-2.5">
                <div className="h-7 w-7 rounded-md bg-stone-200 text-stone-700 flex items-center justify-center shrink-0">
                  <ShoppingBag className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-stone-900">Customer Account</p>
                  <p className="text-xs text-stone-500">Explore Catalog & WebGL 3D Viewer (View Only)</p>
                </div>
              </div>
              <ArrowRight className="h-3.5 w-3.5 text-stone-400 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </CardContent>
        </Card>
        )}

        {/* Regular Login / Register Form */}
        <Card className="border-stone-200/90 bg-white shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex border-b border-stone-200 pb-2">
              <button
                type="button"
                onClick={() => {
                  setMode("login");
                  setErrorMsg(null);
                }}
                className={`flex-1 py-1 text-xs font-bold text-center border-b-2 transition-colors ${
                  mode === "login"
                    ? "border-stone-900 text-stone-900"
                    : "border-transparent text-stone-400 hover:text-stone-700"
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("register");
                  setErrorMsg(null);
                }}
                className={`flex-1 py-1 text-xs font-bold text-center border-b-2 transition-colors ${
                  mode === "register"
                    ? "border-stone-900 text-stone-900"
                    : "border-transparent text-stone-400 hover:text-stone-700"
                }`}
              >
                Create Account
              </button>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {errorMsg && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                  {errorMsg}
                </div>
              )}

              {mode === "register" && (
                <div className="space-y-1">
                  <label htmlFor="login-name" className="text-xs font-semibold text-stone-700">Full Name</label>
                  <input
                    id="login-name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. John Doe"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-stone-200 focus:outline-hidden focus:ring-2 focus:ring-stone-900 bg-stone-50/50"
                  />
                </div>
              )}

              <div className="space-y-1">
                <label htmlFor="login-email" className="text-xs font-semibold text-stone-700">Email Address</label>
                <input
                  id="login-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@artisanstudio.com"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-stone-200 focus:outline-hidden focus:ring-2 focus:ring-stone-900 bg-stone-50/50"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="login-password" className="text-xs font-semibold text-stone-700">Password</label>
                <input
                  id="login-password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-stone-200 focus:outline-hidden focus:ring-2 focus:ring-stone-900 bg-stone-50/50"
                />
              </div>

              {mode === "register" && (
                <div className="space-y-1">
                  <label htmlFor="login-role" className="text-xs font-semibold text-stone-700">Initial Role</label>
                  <select
                    id="login-role"
                    value={selectedRole}
                    onChange={(e) =>
                      setSelectedRole(e.target.value as "merchant" | "customer")
                    }
                    className="w-full px-3 py-2 text-xs rounded-lg border border-stone-200 focus:outline-hidden focus:ring-2 focus:ring-stone-900 bg-stone-50/50"
                  >
                    <option value="merchant">Merchant (Create & Manage 3D Models)</option>
                    <option value="customer">Customer (View 3D Catalog Only)</option>
                  </select>
                </div>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold py-2.5"
              >
                {loading
                  ? "Processing..."
                  : mode === "login"
                  ? "Sign In with Credentials"
                  : "Complete Registration"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
