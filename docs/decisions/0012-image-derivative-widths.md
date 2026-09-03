<title>ADR 0012 — Why the product images looked soft, and what re-sizing them does and does not fix</title>

# ADR 0012 — Card and hero derivatives were narrower than the boxes they fill

**Date:** 2026-09-03 · **Status:** Accepted · **Builds on:** [`AGENTS.md`](../../AGENTS.md) §2, §8

## Context

Every product image on the storefront looked noticeably softer than the source
photo staff uploaded. Not a compression artefact — the cause was resolution.

`processImage` generates three fixed-width WebP derivatives on upload —
`thumb` (200px), `card` (600px), `hero` (1400px) — and never upscales beyond
what the source has. `next/image` never serves more than a derivative has
either: ask it for 900px from a 600px file and it hands back 600px. The
`<img>` element then stretches that 600px bitmap to fill whatever CSS box
`sizes` told the browser it needed, and a browser has no way to invent detail
that was never encoded.

The `card` derivative is what the product grid renders — home page, shop page,
search results, everywhere a shopper sees more than one product at once. Its
`sizes` hint asks for up to 25vw on desktop and up to 100vw on a mobile
feature tile. At **2x device pixels** — an ordinary retina laptop display, or
any mid-range phone bought in the last several years, not an edge case — 25vw
of a 1600px viewport needs roughly 720px, and 100vw of a 400px phone needs
1200px. A 600px file cannot cover either, so the browser upscaled it, and that
upscaling is what "the quality diminishes" was a description of.

## Decision

**Raise the derivative widths to what their boxes actually need at 2x, and
route feature tiles to the wider derivative that already exists rather than
stretching the narrower one further.**

| Derivative | Was    | Now    | Reasoning                                                               |
| ---------- | ------ | ------ | ----------------------------------------------------------------------- |
| `thumb`    | 200px  | 200px  | Only fills a 64px gallery-rail thumbnail; already covers 3x there.      |
| `card`     | 600px  | 960px  | Covers a grid tile up to 25vw at 2x on any desktop viewport in use.     |
| `hero`     | 1400px | 1600px | Covers the product page's main image up to 50vw at 2x on a 1600px view. |

`ProductCard` now reads `heroUrl` instead of `cardUrl` for a `feature`-size
tile specifically, because that tile alone can reach 100vw on a phone — wider
than even the new 960px `card` comfortably covers at 2x. This costs nothing
extra to store: `hero` is already generated and served for the product page.

The admin's own media-manager thumbnail had the identical defect for the same
reason — its preview tile renders at 90vw on a phone from the 200px `thumb`
derivative — and now reads `card` instead.

Quality (`webp({ quality: 82 })`) was left untouched. The images were soft from
too few pixels, not from compression; raising quality without raising
resolution would have added bytes for no visible improvement.

## Consequences — read this before assuming a deploy fixes existing products

**This only changes what gets generated on the next upload.** `finaliseUpload`
deletes the staged original once its derivatives are written — by design, so an
untrusted upload does not linger — and no row anywhere keeps a copy of the
full-resolution source. There is no server-side backfill possible: a product
photographed and uploaded before this ships has its `card` and `hero` objects
already sitting in R2 at the old, narrower widths, under content-hashed keys
that this change does not touch.

**Every product already in the catalogue needs its image re-uploaded to
benefit.** The **Replace** control added alongside the upload-manager repair
(ADR 0009) is exactly the tool for this: it swaps a fresh upload into an
existing image's place in one transaction, keeping its position in the
gallery, so no product needs deleting and re-adding to pick up the new
widths — a re-upload of the same source photo is enough.

Two things worth deciding, not done here because both are judgement calls
rather than obvious fixes:

- **Whether to keep an original for future backfills.** Retaining the source
  in a fourth, private prefix would let a future width change apply without
  asking staff to touch anything — at the cost of roughly doubling media
  storage indefinitely. Left as a future option, not built speculatively.
- **A staff-facing note that existing images are due a refresh.** The admin
  has no "this image predates the current sizing" indicator; whether one is
  worth building depends on how many products are affected once real
  inventory is entered, which is not yet known.

## Verified

`processImage`'s own test suite pins behaviour by `DERIVATIVES.length` and a
1600×1200 fixture, not by literal widths, so it needed no changes and still
passes. A new test on `ProductCard` pins the derivative-selection rule itself
— regular tile gets `card`, feature tile gets `hero` — so a future edit that
quietly reverts to the narrower file fails a test rather than shipping softly
blurred images again.

Rendered both widths from a real supplied photo (the storefront display-wall
shot used on the home page) exactly as `processImage` would, at a CSS box
sized to need more than the old 600px at 2x device pixels, and compared a
matched crop of the busiest detail — the phone-case wall — at 4x zoom. The
600px derivative loses individual case outlines that the 960px derivative
keeps legible.
