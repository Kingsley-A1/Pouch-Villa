# ADR 0020 — Showing every product, and asking what you are looking for

**Date:** 2026-10-19 · **Status:** Accepted · **Builds on:** [ADR 0018](0018-sections-that-fit-a-device.md) · [`AGENTS.md`](../../AGENTS.md) §3

## Context

Two things the client reported on the shop page.

**"View all products" showed 24.** `listPublishedProducts` returns one page and a
cursor; the shop read the page and discarded the cursor, so any catalogue larger
than 24 simply stopped, silently. The page was also ordered by `product.id` — a
random UUID — so the 24 were not even the newest.

**The device finder stopped at the model.** Brand, then model, then everything
that fits — including categories the shopper did not want. They asked for a third
question, "what are you looking for?", offering only what is stocked for the
phone they named, not every accessory in the shop.

## Decision

### Paging

- Browse is **newest first**, paged by keyset on
  `(coalesce(published_at, created_at), id)`. A keyset cannot skip or repeat a
  product when one is published mid-scroll; an offset can.
- Search pages by **offset** into a deterministic relevance order. Relevance is a
  computed float with no stable value to resume from, and re-deriving it per
  request costs more than a one-row drift under a concurrent publish is worth.
- The cursor is an **opaque, validated token** (`domain/product-cursor`). It is
  untrusted input that becomes a query parameter, so its timestamp and UUID are
  re-checked against a strict shape before reaching SQL. A cursor from the other
  kind of list is refused, not guessed at.
- The contract is `GET /api/v1/products` (§3: API first). The shop renders page
  one on the server and `ProductFeed` fetches the rest, with a "Showing 24 of 137"
  line so a shopper knows whether they have seen it all.
- The total is **opt-in** (`withTotal`). The home page and curated sections never
  display it, and a count is a second query on the busiest page.

### "What are you looking for?"

- A third select on the finder, scoped to the device, or to the make's devices
  when no model is chosen yet, or to anything-that-fits when neither is.
- Built from one query, `listFittingCategoriesByDevice`, returned as a map and
  filtered in the browser, so changing your mind costs no request on a mobile
  connection. Categories come from the database; none is named in source (§4).
- **Universal accessories are not offered.** Sections that do not fit a device
  (ADR 0018) have no compatibility rows by design, so a power bank never appears
  under an iPhone. That is the requested behaviour, and it follows from the data
  rather than from a name check.
- The category pills now **carry the chosen device**. Choosing a category is
  narrowing what fits their phone, not starting over.
- A category carried in from a pill that fits no named device is shown as chosen
  rather than silently swapped for "everything".

## Consequences

- **No migration.** Both changes read tables that already exist.
- Cases and screen guards can be offered separately **only if staff file them as
  separate categories.** Where they share one category, the select offers that
  one entry.
- The "Show more" control needs JavaScript. The finder's own form still works
  without it, as before; a no-JS "next page" link was left out because a page that
  shows only page two under a count of "24 of 137" would mislead.
- `device.slug` is unique per brand, not globally, and the finder already filters
  by slug alone. Two makes with an identically named model would share a bucket in
  the fitting map. This predates this change and is noted rather than widened here.
