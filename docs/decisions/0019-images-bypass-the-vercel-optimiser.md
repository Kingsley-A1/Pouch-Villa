<title>ADR 0019 — Why images are served from their sharp renditions, not Vercel's optimiser</title>

# ADR 0019 — Images are served from their pre-built renditions, not `/_next/image`

**Date:** 2026-09-28 · **Status:** Accepted · **Builds on:** [`AGENTS.md`](../../AGENTS.md) §2, §8 · [ADR 0012](0012-image-derivative-widths.md)

## Context

Product-page images broke in production: thumbnails loaded, the main photo did
not, and newer products showed no image at all. Opening one of the broken images
returned `402 OPTIMIZED_IMAGE_REQUEST_PAYMENT_REQUIRED`: the Vercel plan's image
transformation allowance was spent. Vercel kept serving transformations it had
already cached and refused every new one, which is why the failures looked
selective.

The optimiser was doing redundant work. AGENTS.md §8 already requires derivatives
generated on upload, and `processImage` writes `thumb` (200px), `card` (960px) and
`hero` (1600px) WebP renditions to R2 for every product, category, brand and hero
slide image. Each of those renditions then counted as a separate source image
and was resized a second time on request.

The client does not want to pay for a higher Vercel plan.

## Decision

A custom `next/image` loader (`apps/pv-frontend/src/lib/image-loader.ts`, set
via `images.loaderFile`) maps each requested width onto the smallest pre-built
rendition that covers it and returns that file's URL. The browser fetches it
directly from the R2 CDN, or from the static host for bundled photographs. No
request reaches `/_next/image`.

The few photographs bundled in `public/images` get the same treatment from
`scripts/build-static-images.mjs` (sharp, WebP at quality 82, widths 160/640/1200),
with the outputs committed.

## Why not the alternatives

- **`images.unoptimized`** is forbidden by AGENTS.md §2. It would ship full-size
  originals with no `srcset`.
- **Running sharp per request in our own route handler** rebuilds the optimiser we
  are leaving. It would spend serverless CPU and invocations resizing files that
  are already the right size, and it would be slow on a cold start.
- **Cloudflare Image Resizing** is a paid add-on and has the same "pay per
  transformation" shape.

## Consequences

- Image delivery costs only R2 egress, which Cloudflare does not charge for.
  Vercel image usage drops to zero.
- A `srcset` descriptor can name a width larger than the file it points to. The
  browser picks by descriptor and the loader rounds up to the next rendition, so
  the file is always at least as wide as the box needs, up to 1600px.
- Media stored before the rendition pipeline (no content hash) has no siblings
  and is served as stored, at full size. Re-uploading it with **Replace** fixes that.
- Adding a photograph to `public/images` that `next/image` renders means adding it
  to `STATIC_IMAGES` and re-running the script. `tests/image-loader.test.ts` fails
  otherwise.
- The upload widths are duplicated in the loader, which runs in the browser and
  cannot import `@pv/backend`. A test asserts they match `DERIVATIVES`.
