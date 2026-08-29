import type { Availability, ProductVariant } from "./types";

export function formatNaira(value: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(value);
}

export function parseVariants(json: string): ProductVariant[] {
  try {
    return JSON.parse(json) as ProductVariant[];
  } catch {
    return [];
  }
}

const AVAILABILITY_LABELS: Record<string, string> = {
  available: "Available",
  limited: "Limited stock",
  out_of_stock: "Out of stock",
  pre_order: "Pre-order",
  on_request: "On request",
  hidden: "Hidden",
};

export function availabilityLabel(value: Availability | string) {
  return AVAILABILITY_LABELS[value] || value;
}
