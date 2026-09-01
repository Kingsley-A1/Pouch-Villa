import { cn } from "@/lib/utils";
import { PouchMark } from "./pouch-mark";

export function BrandMark({
  inverse = false,
  compact = false,
}: {
  inverse?: boolean;
  compact?: boolean;
}) {
  return (
    <span
      className={cn("inline-flex items-center gap-2.5", inverse ? "text-white" : "text-(--pv-red)")}
      aria-label="Pouch Villa"
    >
      <span className={cn("shrink-0", compact ? "h-9 w-9" : "h-11 w-11")}>
        <PouchMark />
      </span>
      <span
        className={cn(
          "font-serif leading-[.8] font-black tracking-[-.055em] uppercase",
          compact ? "text-xl" : "text-2xl",
        )}
      >
        Pouch <small className="block text-[.58em] tracking-[.04em]">Villa</small>
      </span>
    </span>
  );
}
