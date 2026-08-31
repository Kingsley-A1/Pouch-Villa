import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...values: ClassValue[]) {
  return twMerge(clsx(values));
}

export function toSingle(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}
