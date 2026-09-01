import { cn } from "@/lib/utils";

/**
 * The branded indeterminate progress line.
 *
 * Indeterminate because we genuinely do not know how long a request will take —
 * a faked percentage that stalls at 90% is worse than an honest sweep. Rendered
 * as a real `progressbar` so a screen reader announces it, and it holds a fixed
 * 3px box so appearing and disappearing never shifts the layout under it.
 *
 * Honours `prefers-reduced-motion`: the sweep is replaced by a static bar, since
 * a looping animation is exactly what that setting exists to stop.
 */
export function LoadingLine({
  label = "Loading",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      role="progressbar"
      aria-label={label}
      className={cn("h-[3px] w-full overflow-hidden rounded-full bg-(--pv-line)", className)}
    >
      <div className="pv-loading-sweep h-full w-2/5 rounded-full bg-(--pv-red)" />
    </div>
  );
}

/**
 * A full-block placeholder for a route or panel that is still loading: the line,
 * plus a short honest label. Used by `loading.tsx` boundaries.
 */
export function LoadingBlock({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="grid gap-3 py-16" aria-busy="true">
      <LoadingLine label={label} className="mx-auto max-w-sm" />
      <p className="text-center text-sm text-(--pv-muted)">{label}</p>
    </div>
  );
}
