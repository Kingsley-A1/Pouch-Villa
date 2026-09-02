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
      className={cn(
        "inline-flex items-center gap-2.5",
        inverse ? "text-(--pv-on-brand)" : "text-(--pv-red)",
      )}
      aria-label="Pouch Villa"
    >
      <span className={cn("shrink-0", compact ? "h-9 w-9" : "h-11 w-11")}>
        <PouchMark />
      </span>
      <span
        // The brand serif, the same face the home page's opening line is set in,
        // rather than whatever serif the device happens to ship.
        //
        // In the header (`compact`) the wordmark steps aside below 360 px. Four
        // 44 px controls plus this wordmark do not fit a 320 px screen, and
        // §2 forbids the horizontal scroll that produced — the icons cannot
        // shrink without breaking the 44 px target, so the words go and the mark
        // stays. Nothing is lost to assistive technology: the label on this
        // element already names the shop.
        className={cn(
          "font-(family-name:--pv-font-hero-stack) leading-[.8] font-black tracking-[-.055em] uppercase",
          compact ? "text-xl max-[359px]:hidden" : "text-2xl",
        )}
      >
        Pouch <small className="block text-[.58em] tracking-[.04em]">Villa</small>
      </span>
    </span>
  );
}
