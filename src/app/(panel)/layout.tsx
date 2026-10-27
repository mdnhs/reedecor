"use client";

import React from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import {
  DashboardHeaderProvider,
  PanelLayoutContext,
} from "@/components/layout/dashboard-context";

export default function PanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PanelLayoutContext.Provider value={true}>
      <DashboardHeaderProvider>
        <DashboardLayout forceRoot>
          {children}
        </DashboardLayout>
      </DashboardHeaderProvider>
    </PanelLayoutContext.Provider>
  );
}
