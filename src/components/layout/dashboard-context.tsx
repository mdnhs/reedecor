"use client";

import React, { createContext, useContext, useState, useMemo, useEffect } from "react";

export interface RouteMeta {
  title: string;
  subtitle?: string;
}

const DEFAULT_ROUTE_META: Record<string, RouteMeta> = {
  "/": {
    title: "Home",
    subtitle: "Furniture catalog, 3D models and generation activity",
  },
  "/products": {
    title: "My Products",
    subtitle: "Manage your furniture catalog and 3D models",
  },
  "/create": {
    title: "Create 3D Model",
    subtitle: "Choose how you want to capture your product",
  },
  "/create/single": {
    title: "Create 3D Model",
    subtitle: "Single photo to 3D",
  },
  "/create/multi": {
    title: "Create 3D Model",
    subtitle: "Multi-angle photos to 3D",
  },
  "/credits": {
    title: "Credits & Usage",
    subtitle: "Meshy AI generation credits and cost summary",
  },
  "/settings": {
    title: "Settings",
    subtitle: "Manage profile, API keys and shop preferences",
  },
  "/admin/rbac": {
    title: "Admin RBAC",
    subtitle: "User management and permissions",
  },
  "/admin/assets": {
    title: "Room Assets",
    subtitle: "Manage 3D room props and backdrop assets",
  },
  "/admin/features": {
    title: "Feature Flags",
    subtitle: "Toggle platform features in real time",
  },
};

export function getRouteMeta(pathname: string | null | undefined): RouteMeta {
  if (!pathname || pathname === "" || pathname === "/") {
    return DEFAULT_ROUTE_META["/"];
  }
  const clean = pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  if (DEFAULT_ROUTE_META[clean]) {
    return DEFAULT_ROUTE_META[clean];
  }
  // Prefix matching
  if (clean.startsWith("/admin/rbac")) return DEFAULT_ROUTE_META["/admin/rbac"];
  if (clean.startsWith("/admin/assets")) return DEFAULT_ROUTE_META["/admin/assets"];
  if (clean.startsWith("/admin/features")) return DEFAULT_ROUTE_META["/admin/features"];
  if (clean.startsWith("/create/single")) return DEFAULT_ROUTE_META["/create/single"];
  if (clean.startsWith("/create/multi")) return DEFAULT_ROUTE_META["/create/multi"];
  if (clean.startsWith("/create")) return DEFAULT_ROUTE_META["/create"];
  if (clean.startsWith("/products")) return DEFAULT_ROUTE_META["/products"];
  if (clean.startsWith("/credits")) return DEFAULT_ROUTE_META["/credits"];
  if (clean.startsWith("/settings")) return DEFAULT_ROUTE_META["/settings"];

  return DEFAULT_ROUTE_META["/"];
}

interface DashboardHeaderContextType {
  customHeader: RouteMeta | null;
  setHeader: (meta: RouteMeta) => void;
  resetHeader: () => void;
}

const DashboardHeaderContext = createContext<DashboardHeaderContextType | null>(null);

export function DashboardHeaderProvider({ children }: { children: React.ReactNode }) {
  const [customHeader, setCustomHeader] = useState<RouteMeta | null>(null);

  const value = useMemo(
    () => ({
      customHeader,
      setHeader: (meta: RouteMeta) => setCustomHeader(meta),
      resetHeader: () => setCustomHeader(null),
    }),
    [customHeader]
  );

  return (
    <DashboardHeaderContext.Provider value={value}>
      {children}
    </DashboardHeaderContext.Provider>
  );
}

export function useDashboardHeader(meta?: RouteMeta) {
  const ctx = useContext(DashboardHeaderContext);

  useEffect(() => {
    if (meta && ctx) {
      ctx.setHeader(meta);
      return () => {
        ctx.resetHeader();
      };
    }
  }, [meta?.title, meta?.subtitle]);

  return ctx;
}

export const PanelLayoutContext = createContext<boolean>(false);
