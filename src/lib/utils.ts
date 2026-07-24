import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { Availability, ProductVariant } from "@/lib/types";

export function cn(...values: ClassValue[]) { return twMerge(clsx(values)); }
export function formatNaira(value: number) { return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(value); }
export function parseVariants(json: string): ProductVariant[] { try { return JSON.parse(json) as ProductVariant[]; } catch { return []; } }
export function availabilityLabel(value: Availability | string) {
  return ({ available: "Available", limited: "Limited stock", out_of_stock: "Out of stock", pre_order: "Pre-order", on_request: "On request", hidden: "Hidden" } as Record<string, string>)[value] || value;
}
export function availabilityTone(value: Availability | string) {
  if (value === "available") return "bg-emerald-50 text-emerald-800";
  if (value === "limited" || value === "pre_order" || value === "on_request") return "bg-amber-50 text-amber-800";
  return "bg-zinc-100 text-zinc-700";
}
export function toSingle(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value || ""; }
