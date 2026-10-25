"use client";

import { useEffect, useState } from "react";
import type { AssetCategory, MerchantAssetView } from "@/lib/assets/types";

interface MerchantAssets {
  assets: MerchantAssetView[];
  categories: AssetCategory[];
  loading: boolean;
  error: string | null;
}

export function useMerchantAssets(): MerchantAssets {
  const [state, setState] = useState<MerchantAssets>({
    assets: [],
    categories: [],
    loading: true,
    error: null,
  });

  useEffect(() => {
    let ignore = false;
    async function load() {
      try {
        const res = await fetch("/api/assets");
        const json = await res.json();
        if (!json.success) throw new Error(json.error || "Could not load assets");
        if (!ignore) {
          setState({ assets: json.data, categories: json.categories ?? [], loading: false, error: null });
        }
      } catch (err) {
        if (!ignore) {
          const message = err instanceof Error ? err.message : "Could not load assets";
          setState({ assets: [], categories: [], loading: false, error: message });
        }
      }
    }
    load();
    return () => {
      ignore = true;
    };
  }, []);

  return state;
}
