import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { Availability } from "@pv/backend/domain/types";

export function cn(...values: ClassValue[]) {
  return twMerge(clsx(values));
}

export function toSingle(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

/** Tailwind classes, so this stays in the frontend rather than the domain layer. */
export function availabilityTone(value: Availability | string) {
  if (value === "available") return "bg-emerald-50 text-emerald-800";
  if (value === "limited" || value === "pre_order" || value === "on_request") {
    return "bg-amber-50 text-amber-800";
  }
  return "bg-zinc-100 text-zinc-700";
}
