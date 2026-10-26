"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { resolveFlags, type FeatureFlags, type FeatureKey } from "./catalog";

interface FeaturesContextValue {
  flags: FeatureFlags;
  loaded: boolean;
  refresh: () => Promise<void>;
}

const ALL_ON = resolveFlags([]);

const FeaturesContext = createContext<FeaturesContextValue>({
  flags: ALL_ON,
  loaded: false,
  refresh: async () => undefined,
});

async function fetchFlags(): Promise<FeatureFlags | null> {
  try {
    const res = await fetch("/api/features");
    const json = await res.json();
    return json.success ? { ...ALL_ON, ...json.data } : null;
  } catch {
    return null;
  }
}

export function FeaturesProvider({ children }: { children: React.ReactNode }) {
  const [flags, setFlags] = useState<FeatureFlags>(ALL_ON);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    const next = await fetchFlags();
    if (next) setFlags(next);
  }, []);

  useEffect(() => {
    let ignore = false;
    async function loadInitial() {
      const next = await fetchFlags();
      if (ignore) return;
      if (next) setFlags(next);
      setLoaded(true);
    }
    loadInitial();
    return () => {
      ignore = true;
    };
  }, []);

  const value = useMemo(() => ({ flags, loaded, refresh }), [flags, loaded, refresh]);
  return <FeaturesContext.Provider value={value}>{children}</FeaturesContext.Provider>;
}

export function useFeatures(): FeaturesContextValue {
  return useContext(FeaturesContext);
}

// Off until the real flags arrive so disabled features never flash on screen
export function useFeature(key: FeatureKey): boolean {
  const { flags, loaded } = useContext(FeaturesContext);
  return loaded && flags[key];
}
