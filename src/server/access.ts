import type { AppUser } from "@/lib/supabase/auth-service";

export const PUBLIC_REGISTRATION_ROLES = ["merchant", "customer"] as const;

export function isDemoMode(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.DEMO_MODE === "true" || env.NODE_ENV !== "production";
}

export function isStaff(user: AppUser | null): user is AppUser {
  return user?.role === "merchant" || user?.role === "saas_admin";
}

export const DEMO_MERCHANT_ALIASES = ["demo-merchant-001", "user-merchant", "user-admin"];

export function isMerchantOwner(productMerchantId: string, userMerchantId: string): boolean {
  if (productMerchantId === userMerchantId) return true;
  if (isDemoMode()) {
    if (DEMO_MERCHANT_ALIASES.includes(userMerchantId) && DEMO_MERCHANT_ALIASES.includes(productMerchantId)) {
      return true;
    }
  }
  return false;
}

export function canManageProduct(user: AppUser | null, product: { merchantId: string }): boolean {
  if (!user) return false;
  if (user.role === "saas_admin") return true;
  return user.role === "merchant" && isMerchantOwner(product.merchantId, user.id);
}
