"use client";

import { useState } from "react";
import Image from "next/image";
import { ArrowClockwise, CaretLeft, CaretRight, ImageBroken } from "@phosphor-icons/react";
import type { CatalogueImage } from "@pv/backend/services/catalogue";
import { cn } from "@/lib/utils";

/**
 * The product page's images.
 *
 * It used to render `images[0]` and nothing else, so every photograph after the
 * first was uploaded, stored, paid for in bandwidth — and invisible. Staff had
 * no way to know: the admin showed all of them.
 *
 * A client island, because choosing a picture is a client concern and there is
 * no server round trip worth making for it. The first image still renders with
 * `priority`, so the largest contentful paint is unchanged from the single-image
 * version — the rest are lazy.
 *
 * Every image's load state is tracked here, keyed by URL. Left to the browser, a
 * photograph still in flight is a flat empty box, and one that failed is the
 * broken-image glyph with the alt text printed across the frame — both of which
 * customers on mobile data were seeing. A shimmer says "coming", a message and a
 * retry say "this one failed", and the picture fades in only once it is whole.
 */
export function ProductGallery({
  images,
  productName,
}: {
  images: CatalogueImage[];
  productName: string;
}) {
  const [index, setIndex] = useState(0);
  // Absent means still loading. Keyed by URL so stepping back to a picture that
  // already arrived does not flash the shimmer over it again.
  const [status, setStatus] = useState<Record<string, LoadStatus>>({});
  // Part of the image's React key, so "Try again" mounts a fresh element and
  // the browser issues a fresh request instead of reusing the failed one.
  const [attempts, setAttempts] = useState<Record<string, number>>({});
  const current = images[index] ?? images[0];

  if (current === undefined) {
    return (
      <div className="relative aspect-square overflow-hidden rounded-3xl bg-(--pv-wash)">
        <div className="grid h-full place-items-center text-sm text-(--pv-muted)">
          No image has been uploaded for this product yet.
        </div>
      </div>
    );
  }

  const many = images.length > 1;
  const step = (by: number) => setIndex((was) => (was + by + images.length) % images.length);
  const settle = (url: string, next: LoadStatus) =>
    setStatus((was) => (was[url] === next ? was : { ...was, [url]: next }));
  const retry = (url: string) => {
    setStatus((was) => {
      const next = { ...was };
      delete next[url];
      return next;
    });
    setAttempts((was) => ({ ...was, [url]: (was[url] ?? 0) + 1 }));
  };

  const heroStatus = status[current.heroUrl];

  return (
    <div className="grid gap-3">
      <div
        data-testid="gallery-frame"
        aria-busy={heroStatus === undefined}
        className="relative aspect-square overflow-hidden rounded-3xl bg-(--pv-wash)"
      >
        {heroStatus === undefined ? <Shimmer /> : null}

        {heroStatus === "failed" ? (
          <div className="absolute inset-0 grid place-items-center p-6 text-center">
            <div className="grid justify-items-center gap-3">
              <ImageBroken aria-hidden="true" size={40} className="text-(--pv-muted)" />
              <p className="text-sm font-semibold text-(--pv-ink)">This photo didn&apos;t load.</p>
              <button
                type="button"
                onClick={() => retry(current.heroUrl)}
                className={cn(
                  "inline-flex min-h-11 items-center gap-2 rounded-full px-5 text-sm font-bold",
                  "bg-(--pv-surface) text-(--pv-ink) shadow-[0_2px_10px_-4px_var(--pv-shadow)]",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--pv-red)",
                )}
              >
                <ArrowClockwise aria-hidden="true" size={16} weight="bold" />
                Try again
              </button>
            </div>
          </div>
        ) : (
          <Image
            // Keyed on the image so React swaps the element rather than mutating
            // src on one node, which browsers paint as a flash of the old picture.
            key={`${current.heroUrl}#${attempts[current.heroUrl] ?? 0}`}
            src={current.heroUrl}
            // Named after the product. Every photograph on this page is of the
            // same thing, and the live region below announces which one this is.
            alt={productName}
            fill
            priority={index === 0}
            sizes="(max-width: 1024px) 100vw, 50vw"
            onLoad={() => settle(current.heroUrl, "loaded")}
            onError={() => settle(current.heroUrl, "failed")}
            className={cn(
              "object-cover transition-opacity duration-300",
              heroStatus === "loaded" ? "opacity-100" : "opacity-0",
            )}
          />
        )}

        {many ? (
          <>
            <GalleryStep direction="previous" onClick={() => step(-1)} />
            <GalleryStep direction="next" onClick={() => step(1)} />
            {/*
              A live region, because the arrows change what is on screen without
              moving focus — a screen reader would otherwise announce nothing.
            */}
            <p aria-live="polite" className="sr-only">
              Image {index + 1} of {images.length}
            </p>
          </>
        ) : null}
      </div>

      {many ? (
        // A scrolling row rather than a wrapping grid, so eight images do not
        // push the price and the add-to-cart button below the fold.
        <ul className="flex snap-x snap-mandatory gap-2 overflow-x-auto pb-1">
          {images.map((image, position) => {
            const active = position === index;
            const thumbStatus = status[image.thumbUrl];
            return (
              <li key={image.thumbUrl} className="shrink-0 snap-start">
                <button
                  type="button"
                  onClick={() => setIndex(position)}
                  aria-label={`Show image ${position + 1} of ${images.length}`}
                  aria-current={active ? "true" : undefined}
                  className={cn(
                    "relative block h-16 w-16 overflow-hidden rounded-xl border-2 bg-(--pv-wash)",
                    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--pv-red)",
                    active ? "border-(--pv-red)" : "border-transparent hover:border-(--pv-line)",
                  )}
                >
                  {thumbStatus === undefined ? <Shimmer /> : null}
                  {thumbStatus === "failed" ? (
                    <ImageBroken
                      aria-hidden="true"
                      size={20}
                      className="absolute inset-0 m-auto text-(--pv-muted)"
                    />
                  ) : (
                    <Image
                      src={image.thumbUrl}
                      alt=""
                      fill
                      sizes="64px"
                      onLoad={() => settle(image.thumbUrl, "loaded")}
                      onError={() => settle(image.thumbUrl, "failed")}
                      className={cn(
                        "object-cover transition-opacity duration-300",
                        thumbStatus === "loaded" ? "opacity-100" : "opacity-0",
                      )}
                    />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

type LoadStatus = "loaded" | "failed";

/**
 * The placeholder sweep over an image that has not arrived. Decorative: the
 * frame's `aria-busy` is what tells assistive technology it is still loading.
 */
function Shimmer() {
  // `pv-loop` is what stops the sweep under `prefers-reduced-motion` — see the
  // two-halved kill switch in globals.css.
  return <div aria-hidden="true" className="pv-shimmer pv-loop absolute inset-0" />;
}

function GalleryStep({
  direction,
  onClick,
}: {
  direction: "previous" | "next";
  onClick: () => void;
}) {
  const Glyph = direction === "previous" ? CaretLeft : CaretRight;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${direction === "previous" ? "Previous" : "Next"} image`}
      className={cn(
        "absolute top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full",
        "bg-[color-mix(in_srgb,var(--pv-surface)_88%,transparent)] text-(--pv-ink) backdrop-blur-sm",
        "shadow-[0_2px_10px_-4px_var(--pv-shadow)] hover:bg-(--pv-surface)",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--pv-red)",
        direction === "previous" ? "left-2" : "right-2",
      )}
    >
      <Glyph aria-hidden="true" size={20} weight="bold" />
    </button>
  );
}
