<title>Pouch Villa Platform — Architecture</title>

# Architecture

For an engineer who has just been handed this repository and has to change
something in it safely.

[`AGENTS.md`](AGENTS.md) is the standard — what we will and will not do.
This document is the map — what is actually here, where it lives, and why it is
shaped this way. Where the two disagree, `AGENTS.md` wins and this file is wrong.

The decision records in [`docs/decisions/`](docs/decisions/) are the reasoning
behind the larger choices. This file points at them rather than repeating them.

---

## 1. The shape in one screen

```
pouch-villa/                     pnpm workspace, two packages, one deployment
├── packages/pv-backend/         @pv/backend — the business. No React, no Next.
│   ├── src/domain/              Pure: money, slugs, phone numbers, state machines
│   ├── src/auth/                Sessions, passwords, role codes, permissions
│   ├── src/db/                  Pooled client, retry-aware transactions, migrator
│   ├── src/services/            Business logic — 36 modules
│   ├── src/storage/             Cloudflare R2, image validation and derivatives
│   ├── migrations/              11 forward-only, checksummed SQL files
│   └── tests/                   Unit and live-database integration
│
└── apps/pv-frontend/            @pv/frontend — Next 16 App Router
    ├── src/app/(store)/         Storefront
    ├── src/app/admin/           claim · login · verify-email · (protected)/…
    ├── src/app/api/v1/          17 versioned route handlers — the contract
    ├── src/components/          Presentational only. No fetching, no rules.
    ├── src/lib/                 Browser-safe helpers. Pure.
    ├── src/server/              Thin adapters: cookies, redirects, dispatch
    ├── src/proxy.ts             Security headers, CSP nonce, account redirect
    └── scripts/verify-routes.mjs  Boots the built app and asserts real responses
```

**One deployment, two packages.** The split is not about deploying separately; it
is a wall that a compiler enforces. See
[`docs/decisions/0001-workspace-split.md`](docs/decisions/0001-workspace-split.md).

---

## 2. The rule that shapes everything else

> **The backend package may not import `next`, `next/*`, `react`, `react-dom`,
> or the `@/*` alias. ESLint fails the build if it does.**

This is why the code is laid out the way it is, and it is worth understanding
before you move anything.

A service that imports `next/headers` can only run inside a Next request. It
cannot be called by a script, a scheduled job, a test, or the mobile app the
client will eventually ask for. Once one service does it, the next one copies,
and the business logic quietly becomes a property of the web framework.

So the direction of dependency is one-way and absolute:

```
  app/ route or page  ──▶  src/server/ adapter  ──▶  @pv/backend service  ──▶  db
        (Next)              (cookies, redirects)      (framework-free)
```

Nothing points back up the chain. A service takes plain arguments and returns
plain values; if it needs to know who is acting, that is a parameter.

**The barrel deliberately omits the database.** `@pv/backend`'s `src/index.ts`
does not re-export `./db`, so no driver and no credential can reach a Client
Component through a transitive import. Reach it explicitly: `@pv/backend/db`.

### Where a piece of code belongs

| If it…                                                | It goes in                    |
| ----------------------------------------------------- | ----------------------------- |
| is a rule with no I/O (money, slug, state transition) | `pv-backend/src/domain/`      |
| reads or writes the database                          | `pv-backend/src/services/`    |
| touches cookies, redirects, or `headers()`            | `pv-frontend/src/server/`     |
| renders markup and takes everything as props          | `pv-frontend/src/components/` |
| runs in the browser and touches no server anything    | `pv-frontend/src/lib/`        |

If you cannot decide between the last two, ask whether it would still make sense
in a test with no DOM. If yes, `lib/`.

---

## 3. Data model

Eleven migrations, forward-only and checksummed. The migrator refuses to run if
a file that has already been applied has changed, so an edited migration is
caught rather than silently skipped. That guard has fired in anger: a
comment-only edit to an applied file failed the integration suite, which is the
correct outcome — the fix is a new migration, or a deliberate re-record of the
checksum once the statements are confirmed byte-identical.

| Migration                    | Adds                                                           |
| ---------------------------- | -------------------------------------------------------------- |
| `0001_identity_and_settings` | `staff`, `customer`, sessions, `setting`, `audit_event`        |
| `0002_permission_catalogue`  | `permission`, `role_grant` — RBAC as rows                      |
| `0003_catalogue`             | `category`, `brand`, `device`, `product`, variants, stock      |
| `0004_media_renditions`      | content-hashed derivatives                                     |
| `0005_search`                | `search_vector`, trigram indexes                               |
| `0006_commerce`              | cart, `customer_order`, payments, proofs, reviews, rate limits |
| `0007_saved_views`           | admin saved filters                                            |
| `0008_admin_search`          | cross-entity admin search index                                |
| `0009_storefront`            | home sections, collections, `product_like`                     |
| `0010_section_layout`        | per-section layout: grid, feature, band                        |
| `0011_staff_phone`           | `staff.phone`, so a staff member has a profile of their own    |

### Five conventions you must not break

**Money is an integer count of kobo in a branded type.** `Kobo` will not accept a
bare `number`; construct it with `kobo()` from `domain/money.ts`. There is no
float anywhere in the money path, and there must never be one.

**Stock is an append-only ledger.** Quantity is `sum(delta)` over `stock_entry`,
never a column you update. Under CockroachDB's serializable isolation a
read-modify-write counter is a live bug, and the ledger gives full history free.

**Orders snapshot what they sold.** `order_line` stores the product name, variant
and unit price as they were at placement. Never join an order to live product
data for a historical figure — a receipt must not change because someone edited
a price.

**Nothing is hard-deleted.** Products, orders, customers, categories and reviews
soft-delete with `deleted_at`, `deleted_by` and `deleted_reason`. The one
deliberate exception is a product like, argued in
[`decisions/0006`](docs/decisions/0006-storefront-composition-and-likes.md) §5.

**Slugs are derived, never typed.** `domain/slug.ts` folds a name down and picks
the first free `base`, `base-2`, `base-3`. A published product and every
category, brand and device keep their slug when renamed, because the slug is
already a URL somebody has bookmarked.

### CockroachDB is not Postgres

It speaks the wire protocol. It does not behave the same, and three differences
have each caused a real defect here:

1. **Transactions are retried by the server.** Every transaction body must be
   safe to run twice. Derive values _inside_ the body; never carry state from an
   attempt that was rolled back. `db/transaction.ts` owns the retry loop.
2. **`INT` is 64-bit and comes back as a string.** node-postgres returns int8 as
   a JavaScript string. The convention is `::STRING` in the SQL and `Number()` in
   TypeScript. Passing a raw value to `kobo()` throws, which is how this was
   found.
3. **Latency is per statement**, and opening a connection costs far more than
   running a query — measured on this cluster: ~1.9 s to open, then ~200 ms per
   statement. Prefer one round trip to several, and prefer fewer concurrent
   queries per render, because each concurrent one may open its own connection
   on a cold instance. The dashboard is two queries, not twelve, for this reason.
4. **`jsonb_object_agg` in a correlated subquery is a trap.** The optimiser
   decorrelates it into a join, so a parent row with no children arrives as a
   NULL-extended row and the NULL key fails the **whole statement** — not one
   output row. It is valid PostgreSQL, it passes review, and it only breaks on
   the empty case, which appears the moment a field becomes optional. Aggregate
   pairs with `jsonb_agg` instead; `db/variant-axes.ts` is the shared shape.
   [ADR 0013](docs/decisions/0013-variant-axes-and-cockroachdb-decorrelation.md)
   has the measurements.

Also: UUID primary keys everywhere. A sequential integer creates a write hotspot
on a single range.

---

## 4. Identity — two stacks that never meet

Customers and staff share **no session, no cookie, no table, and no code path**.
A privilege bug in the storefront must not be able to reach the admin.

|               | Staff                                   | Customer                         |
| ------------- | --------------------------------------- | -------------------------------- |
| How it starts | Redeem a role code, which sets the role | Register, or checkout, or Google |
| Cookie        | `pv_staff_session`                      | `pv_customer_session`            |
| Verification  | Email code required                     | None, by design                  |
| Adapter       | `server/session.ts`                     | `server/customer-session.ts`     |
| Lifetime      | Short, idle and absolute                | 30 days absolute                 |

**Google authenticates; it never authorises.** Signing in with Google proves
control of a mailbox and confers nothing else. It may create a _customer_
account, because a customer account carries no authority. It can never create a
staff account: that requires a redeemed role code, and the code carries the role.
See [`decisions/0002`](docs/decisions/0002-access-and-verification.md).

**Sign-in is a server-side redirect, not a widget.** Google's script built its
button from inline styles the CSP refuses, so it rendered as a 448 px logo. The
flow is now an authorization-code redirect we own end to end: `state` compared
with `timingSafeEqual` against a single-use cookie, `nonce` bound into the ID
token, and **the flow read from that cookie rather than the URL** — this route is
the one place both identity stacks are reachable, so which one a callback lands
in must not be a caller's choice. The claim flow's role code travels in a POST
body, never a URL.
[`decisions/0011`](docs/decisions/0011-google-sign-in-redirect-flow.md).

**Permissions are rows, not code.** `permission-codes.ts` lists what _can_ be
granted — that is code, because a permission only means something where a
service checks it. Who _is_ granted it is data the CEO edits at runtime.
`role.manage` and `staff.manage` are CEO-only: whoever can edit grants can grant
themselves anything.

**Customer email is not an identity proof.** It is unverified by design, so order
tracking is authorised by the order reference **plus the registered phone**,
never by email alone.

---

## 5. Request lifecycle

### The proxy runs first

`src/proxy.ts` (Next 16's renamed middleware) does two things on every document
request:

1. Mints a **CSP nonce**, builds the policy from `lib/security-headers.ts`, and
   sets it on both the request (as `x-nonce`, which Next reads and stamps onto
   its own scripts) and the response.
2. Redirects a signed-out request for `/account` to the customer sign-in.

The redirect is an **optimistic** check on cookie presence only — no database
call. The layout still verifies the session server-side. Deleting the proxy would
cost a 307 and the headers; it would not change who can see an account.

### Then the page or route handler

**API first.** Every capability is an `app/api/v1/*` route handler with a
Zod-validated input and a typed output. Server Actions are permitted for forms,
but they are a thin adapter over the same service the route handler calls. Logic
that exists only inside an action is a defect
([`decisions/0003`](docs/decisions/0003-api-first-from-phase-3.md)).

Errors are a discriminated union in the `{ ok, data } | { ok, error }` envelope.
`code` is for a program, `message` is for a person, and they are never the same
field. A driver error never reaches a client.

**Order placement and proof upload are idempotent**, keyed by an
`Idempotency-Key` header. Nigerian mobile data drops mid-request, and a
double-submitted order is a real and foreseeable loss.

### Email fires last, from the adapter

A service reports what happened; the adapter decides what to send. Every send
happens **after the transaction commits** and after authority is checked, never
inside a service — a retried transaction body would send twice.

`server/notify.ts` holds the fire-and-forget wrapper once. It logs the error
**name** only, because §5 forbids a recipient, a token or a proof URL reaching a
log and a driver error frequently carries all three.

Mail is grouped by what it is about: `account-email`, `order-email`,
`contact-email`, `review-email`, `staff-email`. All render through
`email-template.ts`, which escapes every value.

---

## 6. The storefront

**Server Components by default.** `"use client"` needs a reason you can state in
one sentence. Fourteen components under `src/components/` are islands today: the
mobile drawer, the desktop sidebar, the like button, the device finder, the
product gallery, the review modal, the theme toggle, the connection banner, and
the admin forms. Each has its reason written at the top of the file.

**A control inside a link is invalid HTML**, and browsers resolve it by following
the link. It comes up constantly here — the heart on a product card, "View" on an
admin row — so the rule is: the card's link and its controls are **siblings**,
never nested. Where an affordance only needs to look like a button, it is an
`aria-hidden` span inside the link rather than a control.

**Navigation is defined once** in `lib/store-nav.ts` and read by the sidebar, the
drawer and the footer. It used to live in three places and had already drifted.

**The home page is composed at runtime.** Sections are rows the CEO manages at
`/admin/storefront`, in three kinds: a category rule, a brand rule, or a
hand-picked collection. A section that resolves to no products is dropped rather
than rendered as an empty heading
([`decisions/0006`](docs/decisions/0006-storefront-composition-and-likes.md)).

**Components do not fetch.** `ProductGrid` takes its like state as a prop;
`server/product-likes.ts` gathers it in at most two queries. A page that does not
want hearts pays nothing for them.

**Absence is typed.** `readSetting` returns `{ present: false }`, never an empty
string. A missing phone number renders "awaiting confirmation", not a blank space
where a phone number should be. This is rule 2 of §0 and it is load-bearing: a
plausible placeholder that reaches production becomes a lie the client discovers
in front of a customer.

---

## 7. Security posture

Read [`AGENTS.md`](AGENTS.md) §5 in full. The parts that most often surprise
someone new:

- **A strict CSP with no `unsafe-inline`.** Scripts are trusted by nonce plus
  `'strict-dynamic'`. Two consequences: never add a `style` attribute (a nonce
  cannot address `style-src-attr`; use classes), and a hand-written `<script>`
  must ask for the nonce itself — Next only nonces what Next emits. The route
  check hashes every inline style attribute in the rendered HTML and fails the
  build on one the policy does not permit.
- **CockroachDB is not PostgreSQL, and the difference bites on empty sets.**
  Never put `jsonb_object_agg` in a correlated subquery: the optimiser
  decorrelates it and feeds a NULL key into the aggregate, failing the whole
  statement. [ADR 0013](docs/decisions/0013-variant-axes-and-cockroachdb-decorrelation.md)
  has the measurements and the shape that works.
- **Never interpolate an identifier into SQL**, even behind an enum guard. Where
  a shared helper needs to work across tables, it takes a callback holding that
  table's own literal statement. `domain/slug.ts` is the worked example.
- **Uploads are verified by magic bytes**, not by declared MIME type or
  extension. EXIF is stripped by re-encoding.
- **Payment proofs are financial documents.** Private bucket, every access
  audited, never public, never in a log or an error message. Staff read them
  through `api/v1/payments/proofs/[id]/document`, which re-derives authority from
  the session on every request — a signed URL, once opened, sits in browser
  history and stays forwardable for the life of the signature. §8's "never an app
  path" rule is about public product media at scale, not one reviewer opening one
  receipt.
- **Every privileged mutation writes an audit record** in the same transaction as
  the change. Audit records are append-only and redact known-sensitive keys.
- **Rate limiting is database-backed**, not an in-memory bucket: memory does not
  survive an instance recycling, and an attacker who can cause one can reset it.

---

## 8. Verification

`pnpm run verify` runs, in order:

```
format:check → lint → typecheck → check:facts → test → build → test:routes
```

| Layer             | What it covers                                                                    |
| ----------------- | --------------------------------------------------------------------------------- |
| Unit              | Money, slugs, device matching, names, email bodies, retry classification          |
| Integration       | Against a **live CockroachDB** — the retry semantics are the point, so not a mock |
| Permission matrix | Every role × every permission, asserted allowed _and_ denied                      |
| Business facts    | A grep gate that self-tests against known-bad samples before it is trusted        |
| Routes            | Boots the built app and asserts real status codes, redirects and security headers |

**Integration tests need `TEST_DATABASE_URL` and refuse to run if it equals
`DATABASE_URL`.** That guard exists because an early run left twenty-six live
role codes in the production database.

**The route check is the one that catches what a typecheck cannot.** It found
that `/account` returned 200 instead of 307, that every admin route was
unasserted despite the work plan claiming otherwise, and — the worst of the three
— that the product page was throwing while still answering `200`, because the
error happened inside a Suspense boundary and the shell had already streamed. It
now follows the first product link on the home page rather than checking a fixed
list, and it hashes **every inline style attribute** it finds, failing the build
on one the CSP does not permit. If you add a gated route, add it there.

Both gates were proven by breaking them deliberately. A gate nobody has watched
fail is a gate nobody knows works — an earlier version of the nonce check matched
nothing at all and reported a pass.

**Not covered:** there is no end-to-end browser harness. Every admin and account
screen is _implemented_, not _verified in use_. Treat them accordingly.

---

## 9. Running it

```bash
pnpm install
cp .env.example .env          # then fill it in
pnpm run db:migrate
pnpm dev
```

`AUTH_SECRET` must be a real secret; production refuses to start without one.
Nothing is seeded — the first staff account comes from a redeemed role code:

```bash
pnpm --filter @pv/backend claim-code --role CEO
```

`BOOTSTRAP_CEO_EMAIL` pins who may redeem a CEO code, so the code alone is not
enough if it is seen in a terminal or a log.

**Environment variables are for infrastructure, not business facts.** A database
URL is infrastructure. A WhatsApp number is a business fact and belongs in the
admin, where a non-engineer can change it on a Sunday without a deployment.

Google sign-in needs the callback registered under **Authorised redirect URIs**
on the OAuth client — a different box from JavaScript origins, and an entry in
one does not satisfy the other:

```
https://www.pouchvilla.com.ng/api/v1/auth/google/callback
http://localhost:3000/api/v1/auth/google/callback
```

Without it Google refuses with `redirect_uri_mismatch` before anyone reaches a
password field, and no code here can see or report that.

---

## 10. Known gaps

Stated plainly, because finding these by surprise is worse than reading them
here. Current status is tracked in [`docs/work-plan.md`](docs/work-plan.md).

- **No end-to-end harness.** The largest single gap in confidence.
- **Performance budgets are not met, and the cause is measured.** Lighthouse
  against a production build on the CI mobile profile, 2026-09-04:

  | Metric                   | Measured                | Budget |
  | ------------------------ | ----------------------- | ------ |
  | Largest contentful paint | 4.6 s cold              | 2.5 s  |
  | Time to first byte       | 4.4 s cold, 198 ms warm | —      |
  | Total blocking time      | 1,390 ms at 4× CPU      | 200 ms |
  | Script                   | 181 KB                  | 120 KB |
  | Cumulative layout shift  | 0                       | 0.1    |

  **LCP is server response time, and almost all of it is a cold start** — the
  first request on a new instance pays ~1.9 s opening database connections.
  Warm, the whole page answers in 198 ms. `listHomeSections` is the worst single
  query at 640–880 ms warm, because it fans out one query per section.

  Two things that look like causes are not. Fonts are 195 KB but carry
  `font-display: swap`, so they never block paint; 83 KB of that is Latin
  Extended, pulled in **solely by the naira sign**, which sits in that subset's
  `U+20A0-20AB` range. And the largest script chunk is React itself, so the
  budget will not close by deleting an import.

  Caching the storefront's reads and invalidating on admin mutations is the fix
  for the cold start. It is not built. Lighthouse runs in CI and records the
  numbers, but reports rather than gates until it is.

- **Accessibility** is covered by automated component checks and Lighthouse
  assertions. There has been no manual keyboard or screen-reader pass.
- **No backup or restore drill has been performed.**
- **Google sign-in has never completed end to end.** The redirect URI is not yet
  registered in the Cloud Console (§9), so the flow fails at Google. Everything
  on our side of it is verified against a built server; the round trip is not.
- **The catalogue is live but partial.** 15 published products, 12 brands, 6
  categories, 3 active delivery areas — and **no devices at all**, which is why
  the device finder renders nothing: it hides itself rather than promising a
  filter it cannot deliver. Store address, opening hours and contact details are
  still unset and render as "awaiting confirmation".
