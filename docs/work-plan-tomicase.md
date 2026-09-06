<title>Work plan — the Tomi Case revision</title>

# Work plan — the Tomi Case revision

**Raised:** 2026-09-06 · **Source:** the client's four asks, as set out in the
_Pouch Villa meets Tomi Case_ document · **Status:** slices 0–8 built and verified;
slice 9 blocked on a migration

That document is the specification; this file is the delivery order. It takes the
four asks and cuts them into slices small enough that each one is a single-purpose
PR, is mergeable on its own, and leaves the shop better than it found it. Nothing
here is a rebuild — the red ground, the section system, money, stock, orders,
payments and both identity stacks are untouched throughout.

| Slice                                     | State                                                                |
| ----------------------------------------- | -------------------------------------------------------------------- |
| 0 · Reduced motion actually stops         | **Built**, with the pairing enforced by a test                       |
| 1 · Square corners                        | **Built**                                                            |
| 2 · Announcement bar and contact row      | **Built** — renders nothing until the CEO writes the message         |
| 3 · A picker for a single image           | **Built**, differently from the plan below — see the note in slice 3 |
| 4 · Category photographs and brand logos  | **Built** — `0012_catalogue_media.sql`, applied to the test database |
| 5 · The drill-down and the instant filter | **Built** — third step is empty until the models are entered         |
| 6 · Mosaic, product band, View all        | **Built**                                                            |
| 7 · The hero deck                         | **Built** — migration, service, admin list, deck; integration-tested |
| 8 · Continuity between screens            | **Built** — route cross-fade and press states                        |
| 9 · Re-measure                            | **Blocked** — the app database is un-migrated, so `/` errors. See §6 |

---

## 1. Verified against the codebase first

Every structural claim in the source document was checked before this plan was
written. All of them hold:

| Claim                                            | Verified                                                                                                                        |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| No announcement bar exists                       | `(store)/layout.tsx` — `StaffBar` is the topmost element and renders nothing for a shopper                                      |
| The two hero categories are not hardcoded        | `listTopCategoryCards()` at `services/catalogue.ts:452` returns every active top-level category                                 |
| `category` has no image column                   | `migrations/0003_catalogue.sql:19-32` — name, slug, description, sort order, nothing else                                       |
| Category tiles borrow a product photo            | The `LEFT JOIN LATERAL` at `catalogue.ts:484`                                                                                   |
| Reduced motion does not actually stop a loop     | `globals.css:729` caps `animation-duration` at `0.01ms`; `.pv-loading-sweep` at `:757` already carries a hand-written exception |
| Almost no motion exists to build on              | Two `@keyframes` in the entire app — `rise-in` and `pv-loading-sweep`                                                           |
| The five radius sites                            | `product-card.tsx:48,141` · `category-card.tsx:53` · `product-grid.tsx:27` · `globals.css:466`                                  |
| Next free migration numbers                      | `0011_staff_phone.sql` is the last, so `0012` and `0013` are correct                                                            |
| The settings keys to reuse already exist         | `store.address`, `store.whatsapp_number`, `store.contact_email` in `services/settings.ts:23`                                    |
| The cookie-read-on-server pattern is established | `server/theme.ts` — chosen for precisely the no-`unsafe-inline` reason the bar needs                                            |
| The home page is a measured Lighthouse route     | `lighthouserc.json` collects `/` at 360×800 with 4× CPU slowdown                                                                |

**One correction to the source document.** It says the two migrations "both reuse
`media-picker.tsx`, so there is no new upload plumbing." That is optimistic.
`media-picker.tsx` lives at `app/admin/(protected)/products/media-picker.tsx`, imports
`./upload-image` by relative path, and holds files in the browser specifically because
_a product id does not exist yet_ — its R2 key is product-scoped. Pointing it at a
category or a hero slide means lifting it out and generalising that key scope. It is
real work, it is the same work for both migrations, and it gets its own slice below
rather than being assumed away inside another one.

---

## 2. The slices

Nine slices. Each is one PR. The client sees the page change after slice 2.

### Slice 0 · Make reduced motion actually stop

**Blocking. Nothing that loops may merge before this.**

`globals.css:729` sets `animation-duration: 0.01ms` on everything. On a finite
animation that is a stop; on a marquee or an autoplaying deck it is a strobe — an
accessibility defect aimed at exactly the people the setting exists to protect.
`.pv-loading-sweep` already works around it by hand, which is the evidence that the
rule is wrong rather than that the sweep is special.

- Split the blanket rule: keep the `0.01ms` cap for one-shot transitions, add
  `animation: none !important` for anything looping.
- Fold the `.pv-loading-sweep` exception back into the general rule and delete it.

**Test:** an assertion that no infinite animation survives
`prefers-reduced-motion: reduce`. **Ships:** a bug fix, on its own, with nothing
riding on it.

---

### Slice 1 · Square corners

Pure CSS. No schema, no service, no new component. Lands the ask the client can see
fastest.

| File                              | From               | To                                        |
| --------------------------------- | ------------------ | ----------------------------------------- |
| `components/product-card.tsx:141` | `rounded-2xl`      | `rounded-none`                            |
| `components/product-card.tsx:48`  | `rounded-t-[15px]` | removed, with its one-pixel-inset comment |
| `components/category-card.tsx:53` | `rounded-2xl`      | `rounded-none`                            |
| `components/product-grid.tsx:27`  | `rounded-2xl`      | `rounded-none`                            |
| `globals.css:466` `.card-surface` | `1.35rem`          | `0`                                       |

Buttons, fields and the search box **keep their radius** — see §4. Cards keep their
surface fill and hairline border: on red paper a borderless card dissolves into the
page and the grid stops reading as a grid.

**Test:** the existing DOM assertions on the card components, updated.

---

### Slice 2 · The announcement bar and the utility row

The largest single visible change, and it needs no migration.

| Change                                               | Kind | Detail                                                                                                                                                             |
| ---------------------------------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `services/settings.ts`                               | edit | Four keys on `SettingKey`: `store.announcement`, `store.instagram_url`, `store.x_url`, `store.locations`. No `ENVIRONMENT_SEEDS` entry — these are business facts. |
| `admin/(protected)/settings/store-settings-form.tsx` | edit | Four fields in the form that already exists. No new admin page, no new permission.                                                                                 |
| `components/announcement-bar.tsx`                    | new  | Server Component for both rows. Duplicated marquee track for a seamless loop; the second copy `aria-hidden` so a screen reader hears the message once.             |
| `components/announcement-dismiss.tsx`                | new  | ~40-line client island. The close button only, at 44 px.                                                                                                           |
| `server/announcement.ts`                             | new  | Cookie read, modelled line for line on `server/theme.ts`.                                                                                                          |
| `(store)/layout.tsx`                                 | edit | One line, above `<StaffBar />`.                                                                                                                                    |
| `globals.css`                                        | edit | `@keyframes pv-marquee`.                                                                                                                                           |

**The bar renders nothing until the CEO has written the message.** §0 rule 2 — empty is
the correct state, and the CI grep would fail the build on a WhatsApp number typed into
a component, which is the gate working rather than an obstacle.

**Dismissal is a server-read cookie**, so the bar is absent from the HTML rather than
removed from it after hydration. Reading `localStorage` here would push the whole page
down and snap it back — the standard way to lose the CLS budget.

**Tests:** settings round-trip; the bar absent when the key is unset; the bar absent
when the cookie is set; the marquee still under `prefers-reduced-motion` (depends on
slice 0).

---

### Slice 3 · A picker for a single image

> **Built differently from what this section proposed, deliberately.** The plan
> was to lift `media-picker.tsx` out of `products/` and generalise it. Reading it
> properly, that component exists to hold _several_ files in the browser before a
> product id exists, so they can all be uploaded the moment it does — a real
> problem on the product create screen and no problem at all for a category,
> whose row is always saved before its picture is chosen. Generalising it would
> have meant carrying a gallery, a sort order and a deferred upload queue into a
> field with one slot.
>
> What shipped instead is `categories/catalogue-image-field.tsx`: one slot,
> upload / replace / remove, sharing the part that is genuinely common —
> `rejectionReason` and the accepted types — so a file this refuses is exactly
> the file the product form refuses. The backend follows the same reasoning:
> `services/catalogue-media.ts` is its own narrow path that reuses the staging
> table, the pre-signed upload and `processImage`, rather than an option threaded
> through the product gallery service.

<details>
<summary>What this slice originally proposed</summary>

### Lift the media picker

The enabling slice for everything that follows. No user-visible change.

- Move `admin/(protected)/products/media-picker.tsx` and its `upload-image` dependency
  somewhere both the category form and the hero list can reach.
- Generalise the R2 key scope from "product id" to an owner discriminator, so a
  category and a hero slide can each own an image.
- Products keep working through the same component — this is a refactor, with the
  product form's existing tests as its proof.

**Ships:** nothing to look at, and slices 4 and 6 cost half as much because of it.

</details>

---

### Slice 4 · Category and brand imagery

`migrations/0012_catalogue_media.sql` — an image on `category` **and a logo on `brand`** — plus a
picker on both forms of the existing _Brands & Categories_ admin page, which is where the client
asked for them to live.

Without this a category tile keeps borrowing the newest published product's cut-out on a white
background, and a brand card has no logo to carry at all. Tomi Case's tiles are lifestyle
photographs, and that difference is most of why theirs read as bold. **A mosaic of cut-outs will
not.**

`listTopCategoryCards()` gains the category's own image and falls back to the existing lateral join
when there is none, so nothing regresses on day one.

**Tests:** the migration applies; a category with an image returns it; a category without one still
returns the borrowed product image; a brand with no logo still renders its card.

---

### Slice 5 · The drill-down, as the CEO described it

The scope addition of 6 September, and the largest slice here. The path is:

```
Pouches  ─►  brands        ─►  Apple   ─►  iPhone 15  ─►  the pouches that fit
(category)   (logo cards)      (brand)     (model)        (results)
```

**What already exists.** `/browse/[category]` and `/browse/[category]/[brand]` are built. `device`
already carries a `brand_id`, and `product_compatibility` already joins a product to a model — so
"Apple → iPhone 15" is a query, not a schema change.

**What changes.**

| Change                               | Kind | Detail                                                                                                                                                             |
| ------------------------------------ | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `browse/[category]/page.tsx`         | edit | Brand **logo cards**, not text tiles: the logo carried prominently, the name on one line beneath it. Two across at 360 px, four on desktop.                        |
| `components/brand-card.tsx`          | new  | Zero radius, per the client. Falls back to the brand initial where no logo is set, the way `category-card.tsx` already does.                                       |
| `components/instant-filter.tsx`      | new  | The search box on the brand step. Filters the list already on the page — **no navigation, no request**. See below.                                                 |
| `browse/[category]/[brand]/page.tsx` | edit | **Step three becomes the model, not the kind.** Today it lists child categories; the CEO's path asks which iPhone. Skipped entirely where the brand has one model. |
| `services/catalogue.ts`              | edit | `listDevicesInCategoryForBrand()` — the models this brand has that this category actually stocks, so no step ever leads to an empty shelf.                         |

**"We need the search bar not to load like a page does."** Taken literally: the filter on the brand
and model steps never navigates. The full list is already in the HTML the server sent, and typing
hides the rows that do not match — so the result is instant, survives a dropped connection, and
costs one small island rather than a request per keystroke. It is a filter over what is on screen,
not a search of the catalogue; `/search` remains the way to search everything.

**The one thing this slice needs from the client: the models.** The `device` table is empty. "Apple
→ iPhone 15" cannot render until someone enters iPhone models in the admin, and that is data entry,
not engineering. The screen for it already exists at `/admin/devices`.

**Tests:** each step renders and links to the next; a brand with one model skips the model step; a
step with nothing under it is never offered; the filter narrows without navigating; the whole path
completes on a keyboard at 360 px.

---

### Slice 6 · The mosaic, the product band, and View all

The home page's middle, rebuilt on data that now exists.

- The category cards leave the hero and become the bento mosaic — one tall tile plus a two-by-two
  above 720 px, a single stack of squares at 360 px, written so a fourth or a sixth degrades
  gracefully.
- The label plate is solid dark, not a gradient, because it is measured against an arbitrary
  photograph rather than a known token.
- "Latest" becomes a centred band carrying the CEO's own subtitle, with a centred outlined **View
  all products** below it.
- **The CEO's storefront sections stay**, below the new band. Three layouts, hand-picked
  collections, CEO ordering — built, tested, and the shop's own merchandising. The reference having
  nothing like it is not a reason to delete it.

**Tests:** the mosaic renders at 4, 5 and 6 categories; no horizontal scroll at 320 px; axe on `/`.

---

### Slice 7 · The hero deck

Last of the structural work, because it carries the LCP risk and should land on a page whose other
numbers are already known.

| Change                           | Kind   | Detail                                                                                                             |
| -------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------ |
| `migrations/0013_hero_slide.sql` | schema | A slide is editorial, not taxonomy: its own headline, its own photograph, an arbitrary destination.                |
| `services/hero-slides.ts`        | new    | Modelled on `services/home-sections.ts`, which is already this exact shape — CEO-ordered, active/inactive, sorted. |
| `admin/(protected)/storefront/`  | edit   | A second list above the section list, on the page that exists. `product.manage` already gates it.                  |
| `components/hero-deck.tsx`       | new    | Server Component for the slides; a small client island for autoplay and dot state.                                 |
| `(store)/page.tsx`               | edit   | The hero is replaced. `store.hero_headline` becomes the fallback slide, so the page is never empty.                |
| `components/device-finder.tsx`   | keep   | Moves into the header beside search. It is the one thing this shop has that the reference does not — not dropped.  |

**No carousel library.** The track is a CSS grid with `scroll-snap-type: x mandatory`; the arrows
and dots call `scrollIntoView`. Autoplay is the only script, it stops on hover, focus and first
touch, and never starts under `prefers-reduced-motion`. Roughly 1 KB against Slick-plus-jQuery at
~120 KB — which is not a preference, it is all the `resource-summary:script:size` budget leaves room
for.

**Per-word and per-slide delays are utility classes, never `style` attributes.** `style-src-attr`
cannot be addressed by a nonce, and `scripts/verify-routes.mjs` hashes every style attribute on
every route. That also rules out every carousel library that writes inline transforms during server
render.

**The LCP risk, stated plainly.** The hero photograph becomes the largest element on `/`, which is
the route we are already furthest from passing. Slide one gets `priority`, slides two and three are
lazy, and **nothing in the hero fades in** — only the text over it animates, and text is never the
LCP element on a page with a full-bleed photograph. Re-run the Lighthouse numbers before this slice
starts, so we know the baseline we are spending.

---

### Slice 8 · Continuity between screens

Polish, on a structure the client has already approved.

`experimental.viewTransition` — currently absent from `next.config.ts` — turned on, the tapped
product photograph morphing into the product page, a route crossfade, press states on every control,
scroll-driven reveals on the grids. Every one honouring `prefers-reduced-motion`, which slice 0 made
mean something.

---

### Slice 9 · Re-measure

Lighthouse against all four §2 budgets, axe on every changed route, a manual keyboard pass at
360 px, and the numbers written down. Not a formality: slices 6 and 7 are the two that can lose LCP,
and the budgets are `error`-level assertions, so this either passes or the build says so.

---

## 3. Order, and why

```
0 ──► 1 ──► 2                     no schema, no dependencies, the client sees change
      │
      3 ──► 4 ──► 5 ──► 6         picker, imagery, the drill-down, then the mosaic
                        │
                        7 ──► 8 ──► 9    the deck, then polish, then the numbers
```

Slices 0, 1 and 2 need nothing from the client and are built. Slice 4 needs the category photographs
and brand logos. Slice 5 additionally needs the phone models entered in the admin. Slice 7 is late
by choice, not by blocker.

---

## 4. Decisions

Settled by the client on 6 September:

- **How far "square" goes — answered.** _Square what holds content, keep the radius on what you
  press or type into._ Built in slice 1, and asserted in `tests/corner-radius.test.ts` so the next
  find-and-replace cannot quietly take the radius off the buttons too.
- **One list or two — answered.** A `hero_slide` table, as recommended. "Clearance Sales" is not a
  category, and inventing one to hold a banner would put a fake row in the shopper's own navigation.
- **The drill-down — specified.** Category → brands → model → products, with the brand step as logo
  cards and an instant filter. Slice 5.
- **Where the imagery is set — specified.** The existing _Brands & Categories_ admin page, for both
  the category photograph and the brand logo. No new screen.

Settled earlier, and carried forward:

- **Photographs.** The client sets the hero and category images themselves, which is what makes
  slice 4's migration non-optional: today there is nowhere to put one.
- **The red ground.** Red stays; the reference's structure lands on top of it. Worth the client
  hearing once that Tomi Case's boldness is partly white paper behind big photographs, which is why
  our mosaic frames the photography with a solid plate and a gutter rather than running it flush.
- **The device finder.** Moves to the header search slot rather than being dropped.

Still needed from the client, and neither blocks work already in flight:

- **The phone models.** Slice 5's third step is empty until they are entered.
- **One photograph per category, and one logo per brand.** Slice 4 builds the screen; the pictures
  are theirs.

---

## 5. What this plan does not change

[`AGENTS.md`](../AGENTS.md) in full: mobile-first at 360 px, WCAG 2.2 AA as the floor, no
hardcoded business facts, no invented data, server-side authority on every mutation, and
a test with every fix. Slice 0 exists because the reduced-motion rule was quietly failing
that standard; slice 2's settings keys exist because an announcement is a business fact.
A change of look is not a reason to lower any of it.

---

## 6. What is blocking slice 9, and one thing it exposed

### The app database has not been migrated

`0012_catalogue_media.sql` and `0013_hero_slide.sql` have been applied to
**`pouchvilla_test`** only, which is where the integration suite runs. The
database the application itself points at — `defaultdb`, via `DATABASE_URL` — is
still at `0011_staff_phone.sql`.

Until it is migrated, **the home page renders its error boundary**: it now reads
`hero_slide` and joins `catalogue_media`, and neither table exists there. Nothing
in the code is wrong; it is pointed at a schema that predates it.

This was deliberate rather than an oversight.
[`tests/helpers/database.ts`](../packages/pv-backend/tests/helpers/database.ts)
calls `DATABASE_URL` the production database in as many words, recording that an
early test run once left twenty-six live role codes in it. AGENTS.md §7 requires
a migration to be reviewed rather than run on sight, so this one waits for an
explicit go-ahead.

Both migrations are additive: two new tables, four new nullable columns, and one
`DROP NOT NULL` that relaxes a constraint rather than tightening it. Nothing is
dropped and no data is rewritten. The command is `pnpm run db:migrate`.

### A gap in the gate, found by the same failure

`pnpm run verify` passed green while `/` was serving an error boundary.

`scripts/verify-routes.mjs` asserts the HTTP status of every route, and a Server
Component that throws inside a Suspense boundary still answers **200** — the
error is rendered, not returned. So the one check that visits every page cannot
currently tell a working page from a broken one.

**Recommendation:** have `verify-routes.mjs` assert something from the page's own
content as well as its status — the presence of `<main>` with children, or the
absence of the error boundary's own text. It is a small change to the script and
it closes a hole wide enough for a whole broken home page to fit through.
