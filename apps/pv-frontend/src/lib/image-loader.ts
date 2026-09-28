"use client";

/**
 * The `next/image` loader for the whole app, wired in `next.config.ts`.
 *
 * Every image the app shows was already resized by sharp before anyone asked for
 * it: uploads get three WebP renditions written to R2 (`thumb`, `card`, `hero`),
 * and the photographs in `public/images` get theirs from
 * `scripts/build-static-images.mjs`. Sending those through Vercel's optimiser as
 * well meant paying to resize a file that was already the right size — and once
 * the plan's transformation allowance ran out, Vercel answered every new request
 * with `402 OPTIMIZED_IMAGE_REQUEST_PAYMENT_REQUIRED` and the product page showed
 * broken images.
 *
 * This maps the width `next/image` asks for onto the smallest pre-built file
 * that covers it, and the browser fetches that file straight from R2's CDN or
 * the static host. No request reaches `/_next/image`. It is not
 * `images.unoptimized` (which AGENTS.md §2 rules out): every image still arrives
 * resized and in WebP, and the `srcset` still lets a phone take the small one.
 *
 * Runs in the browser, so it cannot import `@pv/backend` — the widths below are
 * duplicated from `DERIVATIVES` and a test asserts the two agree.
 */

/**
 * Must match `DERIVATIVES` in `@pv/backend/storage/image-formats`. Both lists
 * here are ascending, so the first entry wide enough is the smallest that is,
 * and the last is the fallback for a request wider than anything built.
 */
export const UPLOAD_RENDITIONS = [
  { name: "thumb", width: 200 },
  { name: "card", width: 960 },
  { name: "hero", width: 1600 },
] as const;

/** The widths `scripts/build-static-images.mjs` writes for each file below. */
export const STATIC_WIDTHS = [160, 640, 1200] as const;

/**
 * The `public/images` files rendered through `next/image`. A file missing from
 * this list is served as-is at full size; a test fails if a `next/image` source
 * under `/images/` is not listed here, or its renditions were never built.
 */
export const STATIC_IMAGES = [
  "pouch-villa-logo-mark.png",
  "storefront-display-wall.jpg",
  "storefront-exterior.jpg",
] as const;

/**
 * An uploaded rendition's key: `<owner>/<owner id>/<content hash>-<rendition>.webp`,
 * as built by `mediaKey` and `catalogueMediaKey`. Every upload through the
 * pipeline writes all three renditions under the same hash, so any one of them
 * can be swapped for a sibling.
 */
const UPLOADED =
  /^(.+\/(?:products|categories|brands|hero)\/[^/]+\/[0-9a-f]{32}-)(?:thumb|card|hero)\.webp$/;

type LoaderArguments = { src: string; width: number; quality?: number };

export default function imageLoader({ src, width }: LoaderArguments): string {
  const uploaded = UPLOADED.exec(src);
  if (uploaded?.[1] !== undefined) {
    const rendition =
      UPLOAD_RENDITIONS.find((option) => option.width >= width) ?? UPLOAD_RENDITIONS[2];
    return `${uploaded[1]}${rendition.name}.webp`;
  }

  const file = src.startsWith("/images/") ? src.slice("/images/".length) : null;
  if (file !== null && (STATIC_IMAGES as readonly string[]).includes(file)) {
    const covering = STATIC_WIDTHS.find((option) => option >= width) ?? STATIC_WIDTHS[2];
    return `/images/derived/${file.replace(/\.[a-z]+$/, "")}-${covering}.webp`;
  }

  // Media stored before the rendition pipeline existed has a single key and no
  // siblings to choose between, so it is served as stored.
  return src;
}
