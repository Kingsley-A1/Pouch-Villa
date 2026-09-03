<title>ADR 0010 — Section layouts, and seeding without inventing</title>

# ADR 0010 — How a section is drawn, and what a seed may not decide

**Date:** 2026-09-03 · **Status:** Accepted · **Builds on:** [`0006-storefront-composition-and-likes.md`](0006-storefront-composition-and-likes.md) · **Touches:** [`open-questions.md`](../open-questions.md) Q2, Q8

## Context

[ADR 0006](0006-storefront-composition-and-likes.md) made _what_ a home-page
section shows a runtime decision the CEO owns — a category rule, a brand rule,
or a hand-picked collection. It left _how_ a section looks fixed. Every section
rendered as the same grid under the same heading, so a page with three of them
read as one long undifferentiated wall of cards, and a premium line was
presented exactly like a workhorse line.

The client then asked for two specific ranges — **Luxury Cases** and
**Protective Cases** — seeded as ordinary categories, still editable like any
other, with the two sections looking "professional and distinct".

That last word is the whole problem. Two sections cannot be distinct if the
difference is not expressible anywhere.

## Decisions

### 1. Layout is a column, for the same reason kind is

`home_section.layout`, with a `CHECK` constraint and three values. Not a
component chosen by slug, and not a flag in source.

Which treatment suits which range is a merchandising judgement. It changes when
the range changes, when a new line arrives, when a photograph turns out not to
carry a large tile. Encoding "Luxury Cases gets the editorial treatment" in a
component keyed on a category slug would make that judgement a deployment, and
would break silently the moment someone renamed the category — the same failure
mode §4 forbids for business facts, applied to merchandising.

Three treatments, deliberately few. A picker with eight near-identical options
is a way of not deciding.

| Layout    | What it does                                                           | What it is for                                                          |
| --------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `grid`    | Even grid under a left-aligned heading                                 | The default. Every existing section keeps it, so this changed nothing.  |
| `feature` | First product leads at double size, rest fill beside it, serif heading | A small, considered range where one piece can carry the section.        |
| `band`    | Tinted full-bleed band, heading in its own sticky column               | A broad utilitarian range; also breaks up a long run of white sections. |

`feature` drops its asymmetry below `md` and becomes an ordinary two-column
grid. A lead tile only reads as a lead when something sits beside it, and on a
360 px screen nothing does.

### 2. The enum lives in `domain/`, not beside the service

`domain/section-layout.ts` holds `SECTION_LAYOUTS` and the picker labels, and
the service re-exports them.

This is not tidiness. `domain/schemas.ts` validates the layout, and the frontend
imports those schemas into forms. A schema that reached into
`services/home-sections` would pull `db/client` — and with it the Postgres
driver — into a client bundle through a transitive import. That is precisely
what the backend barrel omits `./db` to prevent, and it would have been
introduced by an import that looked entirely reasonable.

### 3. A seed script may create structure. It may not invent facts.

`scripts/seed-storefront.ts` creates the two categories, a section for each, and
the delivery areas. It is idempotent, attributed to the CEO like every other
privileged mutation, and safe to run against production — which is the point,
because unlike a fixture file there is nothing in it that would embarrass anyone
in front of a customer.

Two things it deliberately refuses to decide:

- **Delivery fees.** [Q8](../open-questions.md) asks the client what each area
  costs and how long it takes, and is unanswered. Every seeded area is therefore
  created with a zero fee and **inactive**, which keeps it out of
  `listActiveDeliveryZones` and so out of checkout entirely. An invented fee here
  would not stay a placeholder — it would be quoted to a real customer as a real
  price. Verified after seeding: 18 areas inactive, and **no active zone has a
  zero fee**; the client's three real landmark zones were untouched.
- **Products.** Only the CEO knows what is actually in stock.

A place name is not a business fact of the kind §4 forbids. It makes no claim
about Pouch Villa and it does not go stale. What an area _costs_ is a business
fact, and that is the part left blank.

### 4. The delivery area is free text with suggestions, not a fixed list

Three areas were hardcoded as `<option>` elements in the zone form, which made
the places Pouch Villa serves a fact only a deployment could change. It is now a
text input with a `datalist` of the areas already in use, so the list grows as
the shop does and a new area can always be typed.

Worth noting for whoever reads this next: the client's own zones are
**landmark-based**, not local-government-based. The seeded list is at a
different granularity and they may prefer to delete it. It is inactive, so it
costs them nothing to ignore.

### 5. The storefront sidebar is collapsed by default

It opened expanded, which put a 240 px column of navigation between the viewport
edge and the products on every page. As an icon rail it stays one click from
anywhere without taking room a product row could use. The preference is
browser-local and presentation-only, the same pattern as the admin sidebar: it
changes width, never what is in it.

The four supporting pages collapse to a single icon rather than four. Giving
Privacy, Terms, About and Returns an icon each on the rail would give them more
weight than the shop.

## Consequences

- `HomeSectionInput` gains a required `layout`. The only callers are the admin
  action and the seed script.
- The product card gained a `feature` size and now shows the brand as an eyebrow,
  clamps the name to two lines, and moves "out of stock" to a badge on the image.
  The clamp and the badge are the same fix for one problem: a long name or a
  missing stock line changed a card's height, so prices in a row sat at different
  baselines and the grid looked broken rather than informative.

## A defect found on the way

`staff-login.integration.test.ts` set a session's absolute expiry to
`now() - interval '1 second'` and asserted it was rejected. `now()` is the
_database's_ clock; the check runs against _this process's_ clock. Against a
cloud cluster the two differ by more than a second — the measured round trip
alone was 3.7 s — so the test failed on latency rather than on the rule it was
testing. Widened to an hour, matching the sibling idle test that never had the
problem.
