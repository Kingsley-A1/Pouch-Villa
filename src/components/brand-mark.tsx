import { cn } from "@/lib/utils";

export function BrandMark({ inverse = false, compact = false }: { inverse?: boolean; compact?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", inverse ? "text-white" : "text-[#e30613]")} aria-label="Pouch Villa">
      <span
        className={cn(
          "grid place-items-center rounded-xl font-serif font-black leading-none tracking-[-.06em]",
          compact ? "h-9 w-9 text-base" : "h-11 w-11 text-lg",
          inverse ? "bg-white text-[#e30613]" : "bg-[#e30613] text-white",
        )}
        aria-hidden="true"
      >
        PV
      </span>
      <span className={cn("font-serif font-black uppercase leading-[.8] tracking-[-.055em]", compact ? "text-xl" : "text-2xl")}>
        Pouch <small className="block text-[.58em] tracking-[.04em]">Villa</small>
      </span>
    </span>
  );
}
