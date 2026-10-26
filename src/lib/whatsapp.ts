/**
 * Helper to generate pre-filled WhatsApp messaging URLs for specific furniture products
 */

export function cleanWhatsAppNumber(number: string): string {
  // Remove all non-digit characters
  const digits = number.replace(/\D/g, "");
  // If local Bangladesh number starting with 01, prefix with 88
  if (digits.startsWith("01") && digits.length === 11) {
    return `88${digits}`;
  }
  return digits;
}

export interface WhatsAppProductContext {
  id?: string;
  name: string;
  category?: string;
  priceBdt?: number;
  widthMm?: number;
  depthMm?: number;
  heightMm?: number;
  storeUrl?: string;
}

export function buildProductWhatsAppUrl(
  rawNumber: string | null,
  product: WhatsAppProductContext
): string | null {
  const cleanNumber = rawNumber ? cleanWhatsAppNumber(rawNumber) : "";
  if (!cleanNumber) return null;
  return `https://wa.me/${cleanNumber}?text=${encodeURIComponent(productMessage(product))}`;
}

export function buildProductShareUrl(product: WhatsAppProductContext): string {
  return `https://wa.me/?text=${encodeURIComponent(productMessage(product))}`;
}

function productMessage(product: WhatsAppProductContext): string {
  const priceText = product.priceBdt ? `৳${product.priceBdt.toLocaleString("en-BD")}` : "Negotiable / On Request";
  const dimensionText =
    product.widthMm && product.depthMm && product.heightMm
      ? `${product.widthMm} x ${product.depthMm} x ${product.heightMm} mm`
      : null;

  const lines = [
    `Assalamu Alaikum! I am interested in ordering this 3D furniture piece:`,
    `🛋️ *Product:* ${product.name}`,
    `💰 *Price:* ${priceText}`,
  ];

  if (product.category) {
    lines.push(`📁 *Category:* ${product.category}`);
  }

  if (dimensionText) {
    lines.push(`📐 *Dimensions:* ${dimensionText}`);
  }

  if (product.storeUrl) {
    lines.push(`🔗 *Product Link:* ${product.storeUrl}`);
  }

  lines.push(`\nIs this available for delivery or custom sizing? Please let me know the details.`);

  return lines.join("\n");
}
