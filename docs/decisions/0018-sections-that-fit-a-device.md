<title>ADR 0018 — Sections that fit a device, and sections that do not</title>

# ADR 0018 — Two kinds of section

**Date:** 2026-09-10 · **Status:** Accepted · **Builds on:** [`AGENTS.md`](../../AGENTS.md) §4, §7 · [ADR 0016](0016-paying-in-store.md)

## Context

The client sells two kinds of thing and files them differently.

A **pouch** is defined by what it fits. Uploading one means choosing a make, a
device class and the models it goes on, and a shopper finds it by naming their
phone. That path is built and they are happy with it.

An **accessory** is defined by what it _is_. A power bank is a power bank
whatever phone you own. Asking the person uploading it for a make, a class and a
compatibility list is three questions nobody can answer, and asking a shopper
"which device is it for?" — which is what `/browse/accessories` did — sends them
down a path that leads nowhere.

They supplied fifteen accessory types (recorded in
[`client-inputs.md`](../client-inputs.md) §8) and asked for accessories to be
filed and browsed by those instead.

## Decision

### The difference is a setting on the section, not a name in the code

`category.fits_devices`, a boolean the CEO controls, on the top-level category.
Ticked for Pouches; unticked for Accessories.

The tempting shortcut is a check on the category's name. §4 forbids exactly that
— a category list is a business fact and must not appear in source — and the
rule would break the day they rename "Accessories" to "Gadgets", which is the
kind of thing that happens on a Sunday without telling anybody.

Default `true`, so every category that exists keeps behaving as it does. The
client unticks it once.

### Children inherit; they do not answer for themselves

"Screen Protectors" is not separately a device-fitting section, it is part of
one. `rootFitsDevices` walks up `parent_id` and reads the root, and the admin
only offers the checkbox on a top-level category — a child that could disagree
with its parent produces a tree the storefront cannot render consistently.

An unknown category answers `true`: the shape everything had before this column,
so a bad id degrades to the form the admin already knows rather than to one it
has never seen.

### The product form asks two questions instead of showing every category

Filing a product was a checkbox list of every category, top-level and children
mixed together, which left the shape of the catalogue to whoever happened to be
ticking. It is now **Section**, then **Type** where that section has types.

Both post `categoryIds`, so a product still lands in the same many-to-many rows
and nothing downstream changes. What the section decides is which of the fields
_above_ are asked for at all: a device-fitting section shows make, class and the
model list; one that is not hides all three.

Hiding them also means saving clears what was recorded, because an unrendered
select posts nothing. That is the right outcome for a product moved into a
section where device fit has no meaning, and it is **said on screen** rather than
left as an absence somebody discovers afterwards.

### The storefront asks the matching question

`/browse/<section>` shows makes for a device-fitting section and the section's
own types otherwise. One step rather than two: for accessories the type _is_ the
answer, so a tap lands straight in the filtered shop.

`listCategoryCards` takes an optional parent rather than gaining a near-twin.
The tile's image fallback and product count are eight lines of SQL each, and two
copies is two places for the storefront's artwork rules to drift.

## Consequences

**Run `pnpm run db:migrate`.** Migration `0017_category_fits_devices.sql`.

**The client adds the fifteen types themselves**, under Accessories, in
Admin → Brands & Categories. They are already CRUD there. Seeding them would put
a category list in source, which is the rule this ADR is built around.

**A section with no types renders no Type control**, and a shop with no top-level
category renders no Section control at all — the same rule the device class
follows. That last one is not cosmetic: a required select with one empty option
blocks the form outright, so a shop setting itself up could not have added its
first product. It was caught by the existing create-product tests.

**Multi-category filing is gone.** A product now has one section and at most one
type. Nothing asked for more, and merchandising across sections is what the
hand-picked collections in "Where it appears" already do.
