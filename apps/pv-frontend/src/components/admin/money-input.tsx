"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

function normalize(value: string | number | undefined): string {
  return value === undefined ? "" : String(value).replaceAll(",", "");
}

function format(value: string): string {
  const cleaned = value.replace(/[^\d.]/g, "");
  const [integer = "", ...fractions] = cleaned.split(".");
  const fraction = fractions.join("").slice(0, 2);
  const grouped = integer.replace(/^0+(?=\d)/, "").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return fractions.length > 0 ? `${grouped || "0"}.${fraction}` : grouped;
}

export function MoneyInput({
  name,
  defaultValue,
  className,
  required,
  placeholder,
}: {
  name: string;
  defaultValue?: string | number | undefined;
  className?: string;
  required?: boolean;
  placeholder?: string;
}) {
  const [rawValue, setRawValue] = useState(() => normalize(defaultValue));
  return (
    <>
      <input type="hidden" name={name} value={rawValue} />
      <input
        id={name}
        type="text"
        inputMode="decimal"
        required={required}
        placeholder={placeholder}
        value={format(rawValue)}
        onChange={(event) => setRawValue(normalize(format(event.currentTarget.value)))}
        className={cn(
          "min-h-11 w-full rounded-xl border border-(--pv-line) bg-(--pv-surface) px-3.5 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--pv-red)",
          className,
        )}
      />
    </>
  );
}
