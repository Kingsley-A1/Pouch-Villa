import { DeviceMobile } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/utils";

export function BrandMark({ inverse = false, compact = false }: { inverse?: boolean; compact?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", inverse ? "text-white" : "text-[#e30613]")} aria-label="Pouch Villa">
      <span className={cn("grid place-items-center rounded-lg border-2", compact ? "h-9 w-8" : "h-11 w-10", inverse ? "border-white" : "border-[#e30613]")}>
        <DeviceMobile size={compact ? 21 : 25} weight="bold" aria-hidden="true" />
      </span>
      <span className={cn("font-serif font-black uppercase leading-[.8] tracking-[-.055em]", compact ? "text-xl" : "text-2xl")}>
        Pouch <small className="block text-[.58em] tracking-[.04em]">Villa</small>
      </span>
    </span>
  );
}
