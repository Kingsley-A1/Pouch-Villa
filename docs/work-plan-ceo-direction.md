<title>Work plan — the CEO's direction</title>

# Work plan — the CEO's direction

**Raised:** 2026-09-04 · **Status:** not started · **Supersedes nothing** — this is
a change of direction on a shipped storefront, so it is written as what moves and
what breaks rather than as a fresh build.

The brief, in the CEO's terms: the shop should **feel more pouch-like and alive**.
Seven concrete instructions came with it. This plan takes each one literally,
says what it costs, and is honest about the two that cannot start yet.

---

## 1. The seven

| #   | Asked for                                                                            | Size   |
| --- | ------------------------------------------------------------------------------------ | ------ |
| 1   | The whole background in brand red                                                    | Large  |
| 2   | The exact logo, nothing less                                                         | Small¹ |
| 3   | Two product categories only: Pouch and Accessories                                   | Medium |
| 4   | Remove the brand nav from the header entirely                                        | Small  |
| 5   | Two category cards on one line on mobile, each with an image, then the device finder | Small  |
| 6   | Pouch → brands → a brand → Luxury / Protective → the product                         | Large  |
| 7   | Make it feel alive                                                                   | Medium |

¹ Small to build, **blocked** on an asset we do not have. See §5.

---

## 2. What changes

### 1 · A red page

Today `--pv-page` is white, `--pv-surface` is white, and `--pv-red` is the accent
that draws the eye to one thing at a time. Making the page red inverts that: red
stops being an accent and becomes the ground, so every token layered on it has to
be re-derived. This is a palette rebuild, not a background swap.

Measured, against the current `--pv-red: #e30613`:

| Foreground on brand red  | Ratio    | AA body (4.5)  |
| ------------------------ | -------- | -------------- |
| White                    | **4.88** | Passes, barely |
| `--pv-wash` #f6f3f1      | 4.42     | **Fails**      |
| `--pv-ink` #171717       | 3.67     | **Fails**      |
| White on `--pv-red-dark` | 6.83     | Passes         |

So a red page is reachable at AA, but **only with pure white as the sole
foreground**. There is no headroom for a muted secondary colour, a placeholder, a
disabled state or a tinted caption — `--pv-muted` cannot exist on red at all, and
it is used on roughly every screen we have.

Two ways through, and the choice is the CEO's:

- **A deeper red ground** (`#b9020c` at 6.83, or deeper) with white and a
  white-tinted muted. Keeps the whole-page red instruction and leaves room to
  work. Reads richer and, in our view, more premium.
- **Red as the frame, white as the paper**: full-bleed red page with content on
  white cards. Satisfies "the background is red" as a visitor experiences it,
  costs a fraction of the work, and keeps every existing contrast pass.

Recommendation: the deeper red, because it is what the instruction actually asks
for and the second option is the thing we already have.

### 3 · Two categories

Live data today: six categories — Pouches, Accessories, Luxury Cases, Protective
Cases, Power Bank, and Chargers (already under Accessories) — carrying fifteen
published products.

Luxury Cases and Protective Cases become children of **Pouch**. Power Bank and
Chargers become children of **Accessories**. Nothing is deleted; §6 forbids a
hard delete and these slugs are already URLs somebody may have.

### 4 · The brand nav goes

Deleted, along with the query it runs on every storefront page. A small
performance win as a side effect.

### 5 · Two cards, one row, then the finder

Two cards side by side from 360 px, each with a photograph of something really in
that category, and the device finder directly beneath.

**The finder will render nothing until devices exist.** The `device` table is
empty, which is why it is invisible today — it hides rather than promising a
filter it cannot deliver. Adding phone models in the admin is a data task, not a
code one, and it has to happen for item 5 to mean anything.

### 6 · The drill-down

Pouch → the brands → one brand → Luxury or Protective → the product.

The good news: `/shop` already filters on category, brand and device together, so
this is mostly routing and three new pages, not a schema change.

### 7 · Alive

Turned into things that can be checked rather than argued about: motion on the
category cards, a warmer product card, imagery that shows pouches rather than
grids of chrome, and copy in the shop's own voice. Every one of them honours
`prefers-reduced-motion`, as the storefront already does.

---

## 3. What breaks, and what moves

Stated up front, because each of these is a live thing that stops working the
moment the change lands.

| Breaks                                                                                                                                                                                                   | Fix                                                                                                                  |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| **A parent category returns no products.** `listPublishedProducts` matches the exact slug and does not walk children, so `/shop?category=pouch` would be empty on day one.                               | Change the filter to include descendants, and cover it with a test that asserts a parent returns a child's products. |
| **Three of four home sections point at categories that become children.** Luxury Cases, Chargers, Protective Cases. A section that resolves to nothing is dropped, so the home page silently loses them. | Re-point or rebuild the sections after the re-parenting, in the same change.                                         |
| **Every `--pv-muted` on a red ground.** Secondary text, hints, helper copy, placeholders, disabled states — the whole quiet layer of the interface.                                                      | Re-derive the palette as one pass, not screen by screen.                                                             |
| **The admin inherits the tokens.** It is the same stylesheet. A red admin is not what was asked for and is worse to work in for hours at a time.                                                         | Scope the red ground to the storefront and hold the admin on paper.                                                  |
| **Dark mode has no obvious meaning on a red page.** Three token blocks exist for it and would each need an answer.                                                                                       | Decide deliberately: a deeper red in dark, or drop the toggle on the storefront. Do not leave it half-defined.       |
| **`color-contrast` is a CI assertion.** A wrong palette fails the build rather than shipping quietly.                                                                                                    | Working as intended. Treat a failure as the gate doing its job.                                                      |
| **Category URLs.** Slugs are kept, so existing links survive. Only the parentage moves.                                                                                                                  | Nothing, provided nothing is renamed.                                                                                |

Not broken, and worth saying: money, stock, orders, payments, permissions and
both identity stacks are untouched by all seven items.

---

## 4. The question that has to be answered first

**After "Pouch", which brands does the shopper see?**

The brand table holds twelve rows and they are two different kinds of thing:

- **Phone makers** — iPhone, Samsung, Tecno, Infinix, Oppo, Realme, Redmi, Nokia
- **Accessory makers** — Otterbox Protection, Magsafe, LDNIO, Luxury Pouches

A shopper picking "Pouch" is almost certainly asking _which phone is it for_,
which is what the `device` table exists for and what `product_compatibility`
already models. If that is the intent, the drill-down's second step is devices,
not brands, and the eight phone makers currently sitting in `brand` are in the
wrong table — a data correction, not a code one.

If the CEO means the maker of the pouch, then step two is brands as they stand,
and the phone makers should still be moved out because a product's brand and the
phone it fits are different facts about it.

Either answer is buildable. Building before it is answered means building twice,
so this goes to the CEO as one question with two pictures.

---

## 5. Blocked on the client

**The exact logo.** What we hold is `docs/client/brand/` — three JPEGs. A JPEG
has no transparency, so on a red page it renders as the logo inside a white box.
"The exact logo and nothing less" needs the original: an SVG, AI, EPS or PDF, or
failing that a high-resolution PNG with a transparent background.

Until it arrives, the mark stays as drawn. We will not trace an approximation and
call it the logo.

---

## 6. Sequence

Ordered so that nothing is built twice, and each step is shippable.

1. **Ask the two questions** — §4's brands-or-devices, and §2's choice of red.
   Everything below depends on one or the other.
2. **Chase the logo file.** Longest lead time, no engineering work.
3. **Re-parent the categories** and teach the category filter to walk children,
   with the test that proves it. Re-point the home sections in the same change.
4. **Remove the brand nav.** Independent of everything, ships on its own.
5. **Rebuild the palette** on the chosen red, once, across every token. Contrast
   verified by the existing CI assertion, not by eye.
6. **Category cards and the finder**, once there are devices to find.
7. **The drill-down**, once §4 is answered.
8. **Alive** last, because it is polish on a settled structure and would
   otherwise be done twice.

Steps 3 and 4 can start today. Everything else waits on an answer or an asset,
and we would rather say so than start and rework.

---

## 7. What this plan does not change

The standard. [`AGENTS.md`](../AGENTS.md) still applies in full: mobile-first at
360 px, WCAG 2.2 AA as the floor, no hardcoded business facts, no invented data,
server-side authority on every mutation, and a test with every fix. A change of
look is not a reason to lower any of it, and the contrast measurements in §2 are
in this document precisely because that rule is what makes the red question a
real engineering decision rather than a preference.
