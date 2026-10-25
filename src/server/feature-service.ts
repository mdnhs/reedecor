import type { Context, MiddlewareHandler } from "hono";
import { featuresDb } from "@/lib/supabase/features-db";
import {
  featureOffMessage,
  resolveFlags,
  type FeatureFlags,
  type FeatureKey,
} from "@/lib/features/catalog";

const CACHE_MS = 5000;

class FeatureFlagService {
  private cache: { flags: FeatureFlags; at: number } | null = null;

  async getAll(): Promise<FeatureFlags> {
    const now = Date.now();
    if (this.cache && now - this.cache.at < CACHE_MS) return this.cache.flags;

    let flags: FeatureFlags;
    try {
      flags = resolveFlags(await featuresDb.list());
    } catch (err) {
      console.error("[Features] Could not read feature flags, treating all as enabled:", err);
      flags = resolveFlags([]);
    }
    this.cache = { flags, at: now };
    return flags;
  }

  async isEnabled(key: FeatureKey): Promise<boolean> {
    return (await this.getAll())[key];
  }

  async set(key: FeatureKey, enabled: boolean, userId: string): Promise<void> {
    await featuresDb.set(key, enabled, userId);
    this.cache = null;
  }

  clearCache(): void {
    this.cache = null;
  }
}

export const featureFlags = new FeatureFlagService();

export function requireFeature(key: FeatureKey): MiddlewareHandler {
  return async (c, next) => {
    if (!(await featureFlags.isEnabled(key))) return featureOffResponse(c);
    await next();
  };
}

export function featureOffResponse(c: Context) {
  return c.json({ success: false, error: featureOffMessage, code: "feature_disabled" }, 403);
}
