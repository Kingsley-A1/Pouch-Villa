import type { ReactNode } from "react";

/**
 * A reusable reveal for content that only becomes relevant once a choice is
 * made — the client asked for exactly this in their Q2 answer: _"Where there is
 * need, we should create and use a reusable progressive disclosure animation."_
 *
 * It animates to the content's natural height using `grid-template-rows: 0fr →
 * 1fr`. The obvious alternative — measuring `scrollHeight` in an effect and
 * setting a pixel height — needs client state, re-renders on every toggle, and
 * gets the height wrong the moment a validation message appears inside and makes
 * the content taller. This has none of those problems and stays a Server
 * Component, so it ships no JavaScript at all.
 *
 * Two accessibility points, both load-bearing:
 *
 *   - `inert` when closed, so a field a sighted user cannot see is not one a
 *     keyboard user tabs into and a screen reader announces. `overflow: hidden`
 *     alone hides it visually and lies to everyone else.
 *   - Reduced motion needs no branch here: `globals.css` already neutralises
 *     transition durations under `prefers-reduced-motion: reduce`, so the
 *     content simply appears.
 *
 * The open and closed states are utility classes rather than a `style` object.
 * An inline `style` attribute requires `style-src-attr 'unsafe-inline'`, and §5
 * forbids `unsafe-inline` outright — a single attribute anywhere in the app
 * would have forced the whole policy open.
 */
export function ProgressiveDisclosure({
  open,
  children,
  className = "",
}: {
  open: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`grid transition-[grid-template-rows,opacity] duration-240 ease-[cubic-bezier(0.16,1,0.3,1)] ${
        open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
      } ${className}`}
      inert={!open}
    >
      <div className="overflow-hidden">{children}</div>
    </div>
  );
}
