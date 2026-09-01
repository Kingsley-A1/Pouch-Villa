import { cn } from "@/lib/utils";

/**
 * The Pouch Villa mark, drawn as vector.
 *
 * The client supplied raster only (`docs/client/brand/logo-flat-red.jpg`), and
 * Q7 is still open on a real SVG source, so this is a faithful redraw rather
 * than a trace: a tilted phone-case outline with a triple camera cutout, filled
 * at the base with a poured-liquid shape — the pouch/villa pun in their logo.
 *
 * Being vector is the point. It stays sharp at favicon size and at hero size,
 * takes its colour from `currentColor` so it works on red, white and dark
 * surfaces without a second asset, and costs no network request. It is a
 * stand-in of our own making, and must be replaced the moment the client sends
 * real artwork — it is not a substitute for the vector source Q7 asks for.
 */
export function PouchMark({
  className,
  title,
}: {
  className?: string;
  /** Omit for decorative use beside a visible wordmark. */
  title?: string;
}) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={cn("h-full w-full", className)}
      role={title ? "img" : "presentation"}
      {...(title ? {} : { "aria-hidden": true })}
      focusable="false"
    >
      {title ? <title>{title}</title> : null}
      <g transform="rotate(-13 32 32)">
        {/* The case shell. Drawn as a stroked round-rect so the liquid can sit
            inside it with a shared silhouette. */}
        <rect
          x="18"
          y="7"
          width="28"
          height="50"
          rx="7"
          fill="none"
          stroke="currentColor"
          strokeWidth="3.2"
        />
        {/* Camera cutout: two over one, matching the supplied lockup. */}
        <g fill="none" stroke="currentColor" strokeWidth="2.2">
          <circle cx="25.5" cy="15" r="2.6" />
          <circle cx="32.5" cy="15" r="2.6" />
          <circle cx="25.5" cy="22" r="2.6" />
        </g>
        {/*
          The poured fill. Its own outline follows the shell's bottom radius
          rather than being clipped to it: a <clipPath> needs a document-unique
          id, and this mark renders more than once per page (header, footer,
          favicon), where a duplicate id silently breaks every instance after
          the first. Tracing the corners keeps the component self-contained.
        */}
        <path
          d="M18 39c3.4-3.1 5.6.7 8.9-.7 3.2-1.4 4.6-2.6 7.4-1.4 2.8 1.2 6.6 3 11.7.4V50a7 7 0 0 1-7 7H25a7 7 0 0 1-7-7z"
          fill="currentColor"
        />
      </g>
    </svg>
  );
}
