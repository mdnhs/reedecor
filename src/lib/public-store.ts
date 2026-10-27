import type { StoredProduct } from "@/server/demo-store";
import type { MerchantUserRow } from "@/lib/supabase/db";
import { getProductThumbnail } from "@/lib/product-thumbnail";
import { latestModelAttempt } from "@/lib/product-model";

export interface PublicProduct {
  id: string;
  name: string;
  category: string;
  description: string | null;
  widthMm: number;
  depthMm: number;
  heightMm: number;
  priceBdt: number | null;
  thumbnailUrl: string | null;
  modelUrl: string | null;
  aiGenerated: true;
}

export interface PublicStore {
  id: string;
  name: string | null;
  businessName: string | null;
  bio: string | null;
  whatsappNumber: string | null;
  location: string | null;
  followerCount: number;
  products: PublicProduct[];
  logoUrl?: string | null;
}

function matchesMerchant(productMerchantId: string, merchantId: string): boolean {
  if (productMerchantId === merchantId) return true;
  const aliases = ["demo-merchant-001", "user-merchant", "user-admin"];
  if (aliases.includes(merchantId) && aliases.includes(productMerchantId)) {
    return true;
  }
  return false;
}

function toPublicProduct(product: StoredProduct): PublicProduct {
  const model = latestModelAttempt(product);
  return {
    id: product.id,
    name: product.name,
    category: product.category,
    description: product.description ?? null,
    widthMm: product.widthMm,
    depthMm: product.depthMm,
    heightMm: product.heightMm,
    priceBdt: product.priceBdt > 0 ? product.priceBdt : null,
    thumbnailUrl: getProductThumbnail(product) ?? null,
    modelUrl: model?.modelUrl ?? null,
    aiGenerated: true,
  };
}

export function toPublicStore(merchant: MerchantUserRow, products: StoredProduct[], followerCount: number): PublicStore {
  return {
    id: merchant.id,
    name: merchant.name || null,
    businessName: merchant.business_name || null,
    bio: merchant.bio || null,
    whatsappNumber: merchant.whatsapp_number || null,
    location: merchant.location || null,
    followerCount,
    logoUrl: (merchant as { logo_url?: string | null }).logo_url || null,
    products: products
      .filter((p) => matchesMerchant(p.merchantId, merchant.id) && p.status === "completed")
      .map(toPublicProduct),
  };
}
