"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles, ShieldCheck, Store, ArrowRight } from "lucide-react";
import Link from "next/link";
import { safeNextPath } from "@/lib/auth/route-guard";

export default function LoginPage() {
  const router = useRouter();
  const { login, register, switchDemoRole, demoMode } = useAuth();

  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const selectedRole = "merchant";
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

  const switchMode = (next: "login" | "register") => {
    setMode(next);
    setErrorMsg(null);
  };

  const demoRoles = [
    { role: "saas_admin" as const, label: "SaaS Admin", hint: "Manage platform", Icon: ShieldCheck },
    { role: "merchant" as const, label: "Merchant", hint: "Create 3D products", Icon: Store },
  ];

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[hsl(var(--background))] p-4 sm:p-8">
      <div className="w-full max-w-md space-y-6">
        <div className="space-y-2 text-center">
          <Link href="/" className="inline-flex items-center gap-2">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-brand text-white">
              <Sparkles className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="font-display text-xl font-bold tracking-tight text-stone-900">Artisan 3D</span>
          </Link>
        </div>

        <div className="glass-panel studio-card-shadow space-y-5 rounded-2xl p-5 sm:p-6">
          <div className="grid grid-cols-2 gap-1 rounded-lg bg-stone-100 p-1 text-sm font-medium" role="group" aria-label="Sign in or create account">
            {([
              ["login", "Sign in"],
              ["register", "Create account"],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={mode === value}
                onClick={() => switchMode(value)}
                className={`rounded-md px-3 py-1.5 transition-colors ${
                  mode === value ? "bg-white font-semibold text-stone-900 shadow-2xs" : "text-stone-500 hover:text-stone-800"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {errorMsg && (
              <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                {errorMsg}
              </div>
            )}

            {mode === "register" && (
              <div className="space-y-1.5">
                <label htmlFor="login-name" className="text-sm font-medium text-stone-700">Full name</label>
                <Input
                  id="login-name"
                  type="text"
                  required
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. John Doe"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="login-email" className="text-sm font-medium text-stone-700">Email</label>
              <Input
                id="login-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="login-password" className="text-sm font-medium text-stone-700">Password</label>
              <Input
                id="login-password"
                type="password"
                required
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>

            {mode === "register" && (
              <div className="rounded-lg bg-stone-50 border border-stone-200/80 px-3 py-2 text-xs text-stone-600">
                Account Type: <span className="font-semibold text-stone-900">Furniture Merchant</span>
              </div>
            )}

            <Button type="submit" disabled={loading} className="w-full bg-gradient-brand text-white">
              {loading ? "Please wait..." : mode === "login" ? "Sign in" : "Create account"}
            </Button>
          </form>

          {demoMode && (
            <div className="space-y-3 border-t border-stone-200 pt-5">
              <h2 className="text-sm font-semibold text-stone-900">Try a demo</h2>
              <ul className="space-y-2">
                {demoRoles.map(({ role, label, hint, Icon }) => (
                  <li key={role}>
                    <button
                      type="button"
                      onClick={() => handleQuickDemo(role)}
                      disabled={loading}
                      className="group flex w-full items-center gap-3 rounded-lg border border-stone-200 bg-white p-3 text-left transition-colors hover:bg-stone-50 disabled:opacity-60"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-stone-100 text-stone-700">
                        <Icon className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-stone-900">{label}</span>
                        <span className="block text-xs text-stone-500">{hint}</span>
                      </span>
                      <ArrowRight className="h-4 w-4 text-stone-400 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
