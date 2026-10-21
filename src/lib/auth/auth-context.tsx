"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { UserRole, UserStatus } from "../supabase/auth-service";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  status: UserStatus;
  isGuestFallback?: boolean;
}

interface AuthContextType {
  user: AuthUser | null;
  role: UserRole;
  isLoading: boolean;
  isSaasAdmin: boolean;
  isMerchant: boolean;
  isCustomer: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (
    name: string,
    email: string,
    password: string,
    role: UserRole
  ) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  switchDemoRole: (role: UserRole) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchCurrentUser = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me");
      const json = await res.json();
      if (json.success && json.data) {
        setUser(json.data);
      } else {
        setUser(null);
      }
    } catch (err) {
      console.error("Failed to load user:", err);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let isCancelled = false;
    async function initUser() {
      try {
        const res = await fetch("/api/auth/me");
        const json = await res.json();
        if (!isCancelled) {
          if (json.success && json.data) {
            setUser(json.data);
          } else {
            setUser(null);
          }
        }
      } catch (err) {
        if (!isCancelled) {
          console.error("Failed to load user:", err);
          setUser(null);
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }
    initUser();
    return () => {
      isCancelled = true;
    };
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const json = await res.json();
      if (json.success && json.data) {
        setUser(json.data);
        return { success: true };
      }
      return { success: false, error: json.error || "Login failed" };
    } catch {
      return { success: false, error: "Network error during login" };
    }
  };

  const register = async (name: string, email: string, password: string, role: UserRole) => {
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, role }),
      });
      const json = await res.json();
      if (json.success && json.data) {
        setUser(json.data);
        return { success: true };
      }
      return { success: false, error: json.error || "Registration failed" };
    } catch {
      return { success: false, error: "Network error during registration" };
    }
  };

  const logout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      setUser(null);
      window.location.replace("/login");
    }
  };

  const switchDemoRole = async (targetRole: UserRole) => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/switch-demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: targetRole }),
      });
      const json = await res.json();
      if (json.success && json.data) {
        setUser(json.data);
      }
    } catch (err) {
      console.error("Failed to switch demo role:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const currentRole: UserRole = user?.role || "merchant";
  const isSaasAdmin = currentRole === "saas_admin";
  const isMerchant = currentRole === "merchant";
  const isCustomer = currentRole === "customer";

  return (
    <AuthContext.Provider
      value={{
        user,
        role: currentRole,
        isLoading,
        isSaasAdmin,
        isMerchant,
        isCustomer,
        login,
        register,
        logout,
        switchDemoRole,
        refreshUser: fetchCurrentUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
