<title>Pouch Villa — Accessibility Audit</title>

# Accessibility Audit

**Standard:** WCAG 2.2 Level AA, which [`../AGENTS.md`](../AGENTS.md) §2 sets as
the floor, not the target.
**Date:** 2026-09-03 · **Status:** automated pass complete; **manual keyboard and
screen-reader passes not yet performed**

---

## 1. What has actually been checked

| Method                          | Coverage                                    | Status           |
| ------------------------------- | ------------------------------------------- | ---------------- |
| Automated axe on components     | Component-level, in the frontend test suite | ✅ Passing       |
| Lighthouse accessibility audits | Home, shop, track, contact — asserted in CI | ⚠️ See §3        |
| Manual keyboard pass            | Every flow, unaided by a mouse              | ❌ Not performed |
| Screen-reader pass              | NVDA or VoiceOver through the commerce flow | ❌ Not performed |
| Real-device testing             | A mid-range Android phone                   | ❌ Not performed |

**Automated tools find roughly a third of real barriers.** They catch a missing
label and a bad contrast ratio; they do not catch a focus order that jumps, a
live region that never announces, or a modal that traps nobody. Treat §1 as the
floor of the floor until the manual passes in §4 have been done.

---

## 2. What the design already does right

These are structural, and they are why the automated results are as clean as they
are. Do not undo them.

**Semantic HTML first, ARIA only where semantics run out.** The one genuine ARIA
construct is the device finder's combobox, which follows the ARIA 1.2 pattern
because a native `<select>` on Android opens a full-screen list with no way to
type — and typing a phone model is the entire interaction.

**Every input has a real `<label>`.** Not a placeholder, not an `aria-label` on a
bare field.

**Focus is always visible**, through a `focus-visible` outline in the brand red
at a consistent offset. It has not been removed anywhere.

**Colour never carries meaning alone.** Order status is a word as well as a
colour. A liked product is a filled heart _and_ an `aria-pressed` state.

**Touch targets are at least 44 × 44 px** with spacing between adjacent targets,
which also satisfies WCAG 2.2's new Target Size criterion.

**Reduced motion is honoured** globally: `globals.css` neutralises transition
durations under `prefers-reduced-motion: reduce`, so no component needs its own
branch and none can forget.

**Content that is visually hidden is genuinely hidden.** `ProgressiveDisclosure`
sets `inert` when closed, so a field a sighted user cannot see is not one a
keyboard user tabs into. `overflow: hidden` alone hides it visually and lies to
everyone else.

**Accessible names carry the information the icon does not.** A grid of hearts
would otherwise be a list of identically-labelled buttons; each says "Like _this
product_". The cart says "Your cart, 3 items" rather than leaving the number as
decoration. A link that opens a new tab says so in its name rather than leaving
it to an icon.

**Landmarks are distinct.** The storefront sidebar is a sibling of `<main>`, not
a child, so a screen reader's landmark list reads navigation and content as
separate regions.

---

## 3. Findings

### 3.1 Fixed in this pass

**Brand mark invisible in the footer in dark mode — contrast 1.05:1.** The
footer's brand mark used `--pv-on-brand`, which correctly flips to near-black in
dark mode for text on a red button, painted on the footer's fixed near-black
band. Required 3:1 for large text; measured 1.05:1. Now uses the footer's fixed
white ink. Found by Lighthouse, not by anyone looking at it.

**Breadcrumb bar and the 404 page ignored the dark theme.** Both carried
hardcoded hex colours written as Tailwind arbitrary values, so the theme sweep
missed them and they stayed light-on-light in dark mode. Now tokenised.

### 3.2 Open

| Finding                                          | Criterion                                                | Severity           |
| ------------------------------------------------ | -------------------------------------------------------- | ------------------ |
| No manual keyboard pass has been performed       | 2.1.1 Keyboard                                           | **High** — unknown |
| No screen-reader pass has been performed         | 4.1.2 Name, Role, Value                                  | **High** — unknown |
| `bf-cache` audit failing                         | Not a WCAG criterion; a back-navigation experience issue | Low                |
| Storefront never tested on a real Android device | 1.4.10 Reflow, 2.5.8 Target Size                         | Medium             |

Neither of the two High items is a known failure. They are **unmeasured**, which
in an audit is a different and more honest thing to say than "passing".

---

## 4. The manual passes, when they are run

### 4.1 Keyboard, unaided by a mouse

Complete the whole commerce flow with `Tab`, `Shift+Tab`, `Enter`, `Space` and
arrow keys only. It must be possible, and at every step you must be able to see
where you are.

1. Home → device finder → choose a model with the arrow keys and `Enter`
2. Shop → filter → open a product
3. Choose a variant → add to cart → cart → checkout
4. Sign in, and register a new account
5. Place an order → upload a payment proof
6. Track the order by reference and phone
7. Open the review modal, complete it, and close it with `Escape`
8. The account area: orders, saved, details
9. Admin: sign in, create a product, publish it, moderate a review

Watch specifically for: focus that disappears, focus that lands somewhere
unexpected after a modal closes, a modal that lets focus escape behind it, and
any control reachable only by pointer.

### 4.2 Screen reader

NVDA on Windows or VoiceOver on macOS and iOS, through the same flow. Check that:

- Every form error is announced, not just shown in red.
- The cart count is announced when it changes.
- The like button announces its pressed state.
- Order status is announced as words.
- Headings form a sensible outline when listed on their own.
- The device finder announces the option under the cursor as it changes.

### 4.3 Real device

A mid-range Android phone on a throttled connection, at 320 px and 360 px. Check
that nothing scrolls horizontally at any width, that targets are comfortably
tappable with a thumb, and that primary actions sit within thumb reach.

---

## 5. Record

| Date       | Pass                       | Performed by | Result                                    |
| ---------- | -------------------------- | ------------ | ----------------------------------------- |
| 2026-09-03 | Automated axe (components) | CI           | Passing                                   |
| 2026-09-03 | Lighthouse (4 routes)      | CI           | 0.96; `color-contrast` failing, now fixed |
| —          | Manual keyboard            | —            | Not performed                             |
| —          | Screen reader              | —            | Not performed                             |
| —          | Real device                | —            | Not performed                             |

AGENTS.md §9 requires "a documented manual keyboard pass per release". This table
is where that record goes, and it is currently empty.
