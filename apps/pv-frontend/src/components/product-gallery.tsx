"use client";

import { useState } from "react";
import Image from "next/image";
import { CaretLeft, CaretRight } from "@phosphor-icons/react";
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
 */
export function ProductGallery({
  images,
  productName,
}: {
  images: CatalogueImage[];
  productName: string;
}) {
  const [index, setIndex] = useState(0);
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

  return (
    <div className="grid gap-3">
      <div className="relative aspect-square overflow-hidden rounded-3xl bg-(--pv-wash)">
        <Image
          // Keyed on the image so React swaps the element rather than mutating
          // src on one node, which browsers paint as a flash of the old picture.
          key={current.heroUrl}
          src={current.heroUrl}
          // Named after the product. Every photograph on this page is of the
          // same thing, and the live region below announces which one this is.
          alt={productName}
          fill
          priority={index === 0}
          sizes="(max-width: 1024px) 100vw, 50vw"
          className="object-cover"
        />

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
                  <Image src={image.thumbUrl} alt="" fill sizes="64px" className="object-cover" />
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
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
