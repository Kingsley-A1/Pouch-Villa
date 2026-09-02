<title>ADR 0007 — Account entry, and the storefront's own voice</title>

# ADR 0007 — What a new member sees, and what the shop looks like

**Date:** 2026-09-02 · **Status:** Accepted · **Scope items:** "Register / sign in (Email or Google)" · **Builds on:** [`0006-storefront-composition-and-likes.md`](0006-storefront-composition-and-likes.md)

## Context

ADR 0006 made the customer account reachable. Using it on a phone then exposed
four separate problems, all of them about what the screen tells someone rather
than about what the system does.

Registering redirected straight to the account overview. That page looks the same
whether you joined ten seconds ago or last year, so on a slow connection the
honest reading of a successful sign-up was "nothing happened" — and the next
thing a person does is fill the form in again.

Once inside, the account addressed nobody. The heading said "Your account" and
the four destinations were a tab rail that scrolled sideways below `sm`, which
put "Your details" off the right edge of a 360 px screen with nothing on screen
to say it was there.

The header carried four 44 px controls plus the wordmark. Below 360 px that does
not fit, and the page scrolled horizontally — a plain [`AGENTS.md`](../../AGENTS.md)
§2 violation that predated this work and had not been caught.

And the home page's opening line was set in `.section-title`: 800-weight Plus
Jakarta Sans at -0.028em tracking. Correct for a section heading, cramped for the
one sentence the shop uses to introduce itself.

## Decisions

### 1. A sign-up gets its own screen

`/account/welcome` confirms the account exists, then moves on — automatically
after a short pause, and immediately on a tap. It is reached only with a session
in hand, so it can never congratulate a stranger on an account that does not
exist, and it carries the `next` destination through, so someone who signed up
mid-checkout returns to checkout rather than to the account.

Google sign-in reaches it too, but only when the account was newly created.
`loginCustomerWithGoogle` now reports `created`, derived inside the transaction
body so a CockroachDB retry cannot carry it over from an abandoned attempt. The
`api/v1` route returns the same flag, so a future mobile client can draw its own
welcome rather than re-deriving one.

A returning customer is sent straight on. A confirmation shown to someone who
did not just do anything is noise.

### 2. The account greets the person using it

The session row already carries the name and email, so a greeting costs no extra
query. `domain/person-name.ts` decides what someone is called from the one
free-text name field we hold — first word, falling back to the email's local
part, falling back to `null` so a caller must handle an unnamed customer rather
than render an empty greeting. It is a pure function with tests because the
messy cases (blank, one word, Google account with no name) are exactly the ones
that render as "Hi, ." if nobody thought about them.

### 3. Destinations are cards, not a rail that scrolls sideways

Four cards in a two-column grid from 360 px. Every destination on screen at
once, each one a whole tap target rather than a word, each saying what it holds.
A sideways scroll hides things with nothing to announce them; that is the
failure being removed, not the aesthetic.

### 4. The account moves into the drawer on a phone

Signed out, the user icon in the header is an invitation and earns its place.
Signed in, it was a fifth control competing for a 360 px bar while pointing at
something the drawer already carried. Below `lg` it now steps aside and the
drawer holds the account, on a row showing initials, first name and email —
which also answers the question a shared phone raises and an anonymous icon
never could. The desktop bar has the room and keeps the icon in both states.

That freed one 44 px slot, and the wordmark now also steps aside below 360 px,
which is what finally clears the horizontal scroll at 320 px. The icons could
not shrink instead: 44 px is the §2 floor.

### 5. Playfair Display, for the brand voice only

A third self-hosted face, on the same terms as the other two — a woff2 inside
`node_modules`, so no build or visitor ever reaches Google. Playfair's
letterforms are tall and narrow with long ascenders, which is what gives the
wordmark and the hero line height where Plus Jakarta reads as a wide grey block
at display size.

Used for the brand wordmark, the new `.hero-title`, and the footer's oversized
`POUCH VILLA` — never for body copy or UI labels. A high-contrast serif at 14 px
on a mid-range Android is worse than the sans it would replace.

The footer wordmark is SVG text with `textLength`, not a `vw` font size: it then
fills its container exactly at every width from 320 px to 1280, and keeps doing
so if the face is ever swapped. It is decorative and hidden from assistive
technology — the same words are already the footer's first heading.

### 6. The delivery attribution is not a business fact

Bespoke Technologies' credit and website sit in the footer component, not in the
settings store. §4 protects the facts that are _Pouch Villa's_ to change — an
address, a phone number, a price. This is our attribution, agreed with the client
in [`assumptions-and-confirmations.md`](../archive/pouchhub-prototype/assumptions-and-confirmations.md),
and it is not the shopkeeper's to edit from the admin.

The supplied logo is a horizontal lockup whose own wordmark renders about five
pixels tall at the size a footer credit can afford. The mark is therefore shown
alone, cropped from the supplied file, with the company name set in real text
beside it.

## Consequences

- One more route to keep signed-out: `/account/welcome` is asserted in
  `verify-routes.mjs` alongside the other four.
- `loginCustomerWithGoogle` returns `RegisteredCustomer` rather than
  `AuthenticatedCustomer`. The extra field is additive for API consumers.
- The search page gains a small client component so the field takes focus on
  arrival. It focuses only when the field is empty: re-focusing on a page that
  already has results would cover them with the keyboard.
- A third webfont is shipped. It is subset per-unicode-range by the fontsource
  package and used on two elements per page, but it is a real addition to the §2
  budget and should be measured when Lighthouse CI lands in Phase 5.

## What was considered and rejected

**A modal or toast instead of a welcome screen.** Both are dismissible by
accident, and both put the confirmation on top of the page a person is trying to
read rather than in the flow they are moving through.

**Verifying the email before welcoming.** ADR 0002 settled this: there is no
verification step, and adding one here would reintroduce the inbox round-trip it
removed.

**Shrinking the header icons to fit 320 px.** Below 44 px they stop being
reliable touch targets, which trades a §2 violation for a worse one.
