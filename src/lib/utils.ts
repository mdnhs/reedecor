import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDimension(mm: number, unit: "cm" | "mm" = "cm"): string {
  if (unit === "cm") {
    return `${(mm / 10).toFixed(1)} cm`;
  }
  return `${mm} mm`;
}

export function formatCurrencyBDT(amountUSD: number, rate: number = 122.5): string {
  const bdt = amountUSD * rate;
  return `৳${bdt.toLocaleString("en-BD", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}
