<title>Pouch Villa — Delivery Work Plan</title>

# Delivery Work Plan

**Repository:** [`github.com/Kingsley-A1/Pouch-Villa`](https://github.com/Kingsley-A1/Pouch-Villa) · `main` · CI green
**Standard:** [`../AGENTS.md`](../AGENTS.md) · **Commitment:** [`scope.md`](scope.md) · **Blockers:** [`open-questions.md`](open-questions.md) · **Decisions:** [`decisions/`](decisions/)

**Status at last update (2026-09-03):** Phases 0–2 complete. **Phase 3 is built and green except for its E2E harness**; Phase 4 has started with the client's Q2/Q7 interface asks. The storefront half has now caught up with the admin — home-page composition, likes and the customer account all shipped on 2026-09-02, closing three signed-scope rows that §1 still listed as absent. See §4.

> §1 and §2 below are the original assessment of the inherited prototype, kept as
> the record of _why_ the rebuild was chosen. They describe PouchHub as it was
> received, not the system as it stands. Everything from §3 onward is current.

---

## 1. Verdict on the inherited codebase _(historical — as assessed at clone time)_

PouchHub was a **1,603-line prototype**, and an honest one — its own documentation stated that payments, customer accounts and live stock were _"intentionally out of scope"_. It was built to demonstrate a phone-case storefront, and at that it succeeded.

It was not a foundation for the signed scope, and the gap was not close:

| Scope item                                    | Present in PouchHub                                                               |
| --------------------------------------------- | --------------------------------------------------------------------------------- |
| Browse, search & filter                       | ⚠️ Partial — `LIKE '%q%'`, no relevance or index                                  |
| Specs & variants                              | ❌ A JSON text blob; no per-variant price or stock                                |
| Like & share                                  | ❌ Absent                                                                         |
| Add to cart                                   | ❌ **No cart exists**                                                             |
| Register / sign in (Email or Google)          | ❌ **No customer accounts at all**, by design                                     |
| Place order                                   | ❌ No order or order-line entity                                                  |
| Pay by transfer                               | ❌ Absent                                                                         |
| Payment proof                                 | ❌ Absent                                                                         |
| Track order                                   | ❌ Absent                                                                         |
| Review product                                | ❌ Absent                                                                         |
| Contact                                       | ⚠️ A WhatsApp message _preview_ that deliberately sent nothing                    |
| CEO-configurable RBAC                         | ❌ A hardcoded compile-time map — **structurally could not** satisfy the scope    |
| Orders / Payments / Customers / Reviews admin | ❌ Absent. The "Customers" screen was `GROUP BY` over reservations, not an entity |

Roughly **two of twelve** customer-flow items and **two of eight** admin pages existed in any usable form.

There was also a discovery worth stating plainly: **PouchHub _was_ a renamed Pouch Villa prototype.** The database global was `__pouchVillaDb`, the session cookie `pv_admin_session`, every CSS token `--pv-*`. The rename to Pouch Hub only ever touched the surface.

**Recommendation, taken: keep the repository, rebuild the substance.** The clone was worth having for its design system, its accessibility discipline, its verification harness and its documentation habit. The schema, persistence layer, auth model and admin architecture were all load-bearing in the wrong direction, and every one was cheaper to replace than to migrate.

---

## 2. Keep / Rebuild / Delete — outcome

| Area                     | Prototype problem                                                  | Status                                                          |
| ------------------------ | ------------------------------------------------------------------ | --------------------------------------------------------------- |
| **Design system**        | Genuinely good — semantic tokens, focus rings, 44 px targets       | ✅ Kept and retheme                                             |
| **Verification harness** | Right instinct, thin coverage                                      | ✅ Kept and extended — see §5                                   |
| **Persistence**          | `node:sqlite`, silent fallback to `:memory:`, `/tmp` on serverless | ✅ Replaced — CockroachDB, pooled, retry-aware, fails loudly    |
| **Product schema**       | `variants_json` TEXT; colour filter was `LIKE '%blue%'`            | ✅ Replaced — variants as rows, axes as data                    |
| **RBAC**                 | Compile-time `Record<Role, Permission[]>`                          | ✅ Replaced — roles and grants as rows the CEO edits at runtime |
| **Admin architecture**   | Ten screens in one catch-all route, minified one-liners            | ✅ Replaced — one route, one file per section                   |
| **Auth**                 | Six findings, one critical — see §2.1                              | ✅ Replaced — separate stacks, server-side revocable sessions   |
| **Media**                | Wrote to `public/uploads`; cannot work on serverless               | ✅ Replaced — direct-to-R2 pre-signed upload                    |
| **Search**               | `LIKE '%q%'`, unindexable                                          | ✅ Replaced — Postgres FTS + trigram                            |
| **Images**               | `unoptimized: true` globally, to dodge a hosting-plan limit        | ✅ Removed — `next/image` with per-environment `remotePatterns` |
| **References**           | `Math.random()` + 4 digits into a `UNIQUE` column                  | ⏳ Phase 3 — order references not yet built                     |

### 2.1 Auth findings — all resolved

| #   | Finding                                                                | Resolution                                                               |
| --- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| 1   | 🔴 Deployment-ID-derived signing key — a deployment ID is not a secret | Removed. Production without `AUTH_SECRET` refuses to start.              |
| 2   | 🟠 Env-var admin credentials re-applied on every boot                  | Removed. No account is seeded; access comes from a redeemed role code.   |
| 3   | 🟠 No revocation — stateless 8-hour JWT                                | Server-side `staff_session`; suspension revokes in the same transaction. |
| 4   | 🟠 No login rate limiting                                              | Five attempts per email per fifteen minutes, read from the audit trail.  |
| 5   | 🟡 Table name interpolated into SQL                                    | That code path is deleted.                                               |
| 6   | 🟡 Inconsistent password minimums — 8 vs 12                            | One minimum, 12, in `@pv/backend/auth/password`.                         |

### Deleted

Reservations, `back_in_stock_interests`, the WhatsApp-preview flow, all `pouch-villa-*` localStorage keys, all prototype seed data, all PouchHub copy, `.vercel`/`.openai` host metadata, and the entire SQLite layer.

**`product_devices` was kept**, and the earlier caveat is now resolved: [`open-questions.md`](open-questions.md) Q1 answered _accessories, no handsets_, which makes device compatibility the catalogue's differentiating facet rather than a leftover. It ships as `product_compatibility` with its own admin screen.

---

## 3. Architecture as built

```
packages/pv-backend/          @pv/backend — imports nothing from next/* or react
  src/domain/                 money (branded kobo), Zod schemas, checked accessors
  src/auth/                   sessions, role codes, permission catalogue, passwords
  src/db/                     pooled client, retry-aware transactions, migrations
  src/services/               business logic — catalogue, products, media, staff,
                              roles, settings, delivery, devices, customers, email
  src/storage/                R2 client, image validation and derivatives
  migrations/                 forward-only, checksummed

apps/pv-frontend/             @pv/frontend — Next 16 App Router
  src/app/(store)/            storefront
  src/app/admin/              claim · login · verify-email · (protected)/…
  src/server/                 thin adapters over @pv/backend (cookies, redirects)
```

**Load-bearing choices, all now implemented**

- **Stock is an append-only ledger.** Quantity is a sum, never a mutated counter — correct under CockroachDB's serializable isolation, and it yields a full stock history for free.
- **Money is integer kobo** in a branded type a bare `number` cannot satisfy.
- **Permissions are rows.** The CEO edits Manager and Employee grants at runtime; the CEO role is protected, and `role.manage`/`staff.manage` cannot be delegated to any other role.
- **Two identity stacks** sharing no session, cookie, table or code path. Google authenticates for both and authorises for neither — see [`decisions/0002-access-and-verification.md`](decisions/0002-access-and-verification.md).
- **Variant axes are data**, so the catalogue absorbs a change in what is sold without a migration.
- **Media is validated by magic bytes**, re-encoded to strip EXIF, and served as pre-generated WebP derivatives from immutable content-hashed keys.

---

## 4. Phases

Each phase ends at a **gate** — a demo against the acceptance line, with `pnpm run verify` output pasted.

### ✅ Phase 0 — Foundation

Prototype domain code and branding stripped. CockroachDB with retry-aware transactions and forward-only checksummed migrations. `tsconfig.base.json` tightened. GitHub Actions CI: format, lint, typecheck, business-fact grep, tests, build, route check. pnpm workspace split. Prettier.

**Gate met:** CI green on `main`; migrations applied and idempotent on re-run; the hardcoded-fact check self-tests against known-bad samples before it is trusted, and caught two real violations on its first run.

### ✅ Phase 1 — Identity & RBAC

Staff auth: role-code account creation, password and Google sign-in, code-based email verification, server-side revocable sessions, per-email rate limiting, audit log. Roles and grants as data. CEO bootstrap via an audited CLI — never an env var.

**Gate met:** the permission matrix passes in both directions (3 roles × 20 permissions); a CEO permission change takes effect for a signed-in Manager without a deploy; a revoked or suspended session dies immediately. All verified against a live CockroachDB.

### ✅ Phase 2 — Catalogue & media

Products, variants, variant axes, categories (2-tier), brands, devices and compatibility. Full admin CRUD — create, edit, price, stock, publish/unpublish, soft-delete, restore — mobile-first. Direct-to-R2 upload with pre-signed URLs, magic-byte validation, EXIF stripping, thumb/card/hero WebP derivatives on immutable content-hashed keys. Postgres FTS with trigram fuzzy matching. Faceted filtering by category, brand and device.

**Gate met, with one carry-over.** A staff member can create a product with variants and images, edit it, unpublish it and delete it, every step audited; search returns the right product for a misspelling ("otterbocks" → "OtterBox Defender Case"), for a description-only word, and for a plural. Publishing is refused for a product with no active priced variant.

> **Carry-over to Phase 3:** the create-a-product-on-a-phone run-through has been verified by service-level and integration tests, not by a human on a handset, because there is no E2E harness yet and no CEO account has been claimed. It is folded into Phase 3's E2E work rather than left as a silent gap.

### ⏳ Phase 3 — Commerce _(next — largest remaining block)_

The customer half of the system, none of which exists yet.

1. **Customer identity.** Email/password + Google, recovery. No role codes, no 2FA, and **no email verification** — per [`decisions/0002`](decisions/0002-access-and-verification.md), an inbox round-trip mid-checkout is the most expensive step we could add. Customer email is a contact channel, not an auth factor.
2. **Cart.** Guest and authenticated, merged on sign-in.
3. **Checkout and order placement**, with an **idempotency key** — Nigerian mobile data drops mid-request and a double-submitted order is a real, foreseeable loss.
4. **Order snapshots.** Price, product name and variant frozen at placement; a receipt must never change because someone edited a price.
5. **Order references** from a CSPRNG with real entropy, not `Math.random()`.
6. **Bank transfer** instructions read from the settings store (already populated and admin-editable).
7. **Payment-proof upload** to the **private** R2 bucket, short-lived signed URLs, every access audited.
8. **Order tracking** against the Q6 state machine, and the `/profile` page.
9. **Reviews** — anyone may review, held for approval before publication (Q9).
10. **Contact requests** and transactional email.
11. The four admin stubs — Orders, Payments & Proofs, Reviews, Contact — filled in behind their existing permissions.
12. **E2E harness**, and the mobile run-throughs carried over from Phase 2.

**Gate:** browse → filter → variant → cart → sign in → order → transfer → proof → track → review passes E2E on a mobile viewport in about five minutes; a double-submitted order creates exactly one order.

**Status — 2026-09-01. Items 1–11 built and verified; item 12 (E2E) outstanding.**

The double-submission half of the gate is met and tested against a live
CockroachDB, not a mock:

```
✓ creates exactly one order when the same request is submitted twice
✓ creates exactly one order when both submissions race
✓ does not change a placed order when the product's price later changes
✓ takes the stock it sold out of the ledger
✓ authorises by reference plus the registered phone, in any format
✓ refuses to dispatch a pickup order even from preparing
✓ returns stock to the ledger when an order is cancelled
```

The full-flow half is **not** met: there is no browser harness yet, and it needs
a claimed CEO account and real catalogue data to run against. Both are still
outstanding — production holds 0 staff and 0 products.

Two defects were found by these tests rather than by review, and both are worth
recording because neither was visible from reading the code:

- The state machine gated _entry_ to `ready_for_pickup` and `dispatched` by
  fulfilment, but not their _exits_, so a delivery order that somehow reached
  `ready_for_pickup` could be completed. Exits are now gated too.
- CockroachDB's `INT` is 64-bit and node-postgres returns int8 as a **string**.
  New services passed those straight to `kobo()`, which threw. The established
  convention — `::STRING` in SQL, `Number()` in TS — now applies throughout.
  This is precisely what §9's "against a real CockroachDB, not a mock" is for.

**Also delivered under Phase 3, beyond the original twelve items:**

- `app/api/v1` exists at last — twelve route handlers, per
  [`decisions/0003-api-first-from-phase-3.md`](decisions/0003-api-first-from-phase-3.md).
- Argon2id with transparent rehash-on-login and a fail-open breach check
  ([`decisions/0004`](decisions/0004-password-hashing.md)).
- The route gate now asserts the admin redirect it had only claimed.

### ⏳ Phase 4 — Admin operations

Dashboard depth, saved views, bulk actions, and the operational polish that only surfaces once real orders exist. Supporting pages — About, Privacy, Terms — are already admin-editable and render an explicit _awaiting confirmation_ notice until Q10 lands.

**About and Return & Warranty content has landed** ([`decisions/About-Policy.md`](decisions/About-Policy.md); [`open-questions.md`](open-questions.md) Q10) and is filed here, not yet built: a new `policy.returns` settings key (Return & Warranty is distinct from Terms & Conditions, per the client's own document), and the `/about` and `/returns` pages themselves — `/about` does not exist as a route yet even as a placeholder. Privacy Policy wording and the NDPR data-retention question remain open, so `/privacy` keeps its _awaiting confirmation_ notice regardless.

**Started 2026-09-01, client-shaped first.** The client's answers to Q2 and Q7
ask for different things than "dashboard depth", and those come first because
they are what the delivery will be judged on:

- **Light and dark themes, out of the box** (Q7). Every colour resolves through a
  semantic token; the choice is stored in a cookie and stamped onto `<html>`
  **server-side**, so there is no flash of the wrong theme and no inline script
  for a strict CSP to have to whitelist. Absent cookie means follow the system.
- **A reusable progressive-disclosure animation** (Q2), used at checkout, in the
  review modal and on the admin order and payment screens. It is a Server
  Component using `grid-template-rows: 0fr → 1fr`, so it ships no JavaScript and
  is `inert` when closed rather than merely invisible.
- **A review completed in a modal** (Q2) — no separate review page, no sign-in
  wall, rating first and the rest revealed after.
- **Fewer fields on product upload** (Q2) — slug derived from the name, summary
  collapsed into description.

**Ops depth, added 2026-09-01:**

- **Dashboard depth.** Ordered by what someone has to _do_: the queues waiting on
  a person lead, money next, slow-moving inventory counts last. Revenue counts
  only from `payment_confirmed` onwards, so the figure never includes money that
  has not reached the bank. Built as **two queries, not twelve** — at 2–3s per
  query this screen would otherwise take half a minute to paint.
- **Saved views.** The filters staff return to daily, stored as a query string
  rather than a result set, so a view is always current. Personal by default;
  CEO and Manager can share one with the team. Migration
  [`0007_saved_views.sql`](../packages/pv-backend/migrations/0007_saved_views.sql),
  applied to `pouchvilla_test` and `defaultdb`.
- **Bulk actions** on the reviews and orders queues. Order steps are only offered
  when the list shares one status and one fulfilment path, so a batch can never
  mix a pickup and a delivery order into one "dispatch". Every order still goes
  through the state machine and gets its own audit record; there is no bulk path
  that bypasses either.

**Storefront parity, added 2026-09-02.** Three signed-scope rows that §1 lists as
absent are now built, recorded in
[`decisions/0006-storefront-composition-and-likes.md`](decisions/0006-storefront-composition-and-likes.md).
Migration
[`0009_storefront.sql`](../packages/pv-backend/migrations/0009_storefront.sql),
applied to `pouchvilla_test` and `defaultdb`.

- **Home page composition.** The home page rendered one hardcoded grid of the
  eight newest products — the only arrangement the business could ever have,
  changeable only by a deployment. It is now composed at runtime from sections
  the CEO manages at `/admin/storefront`, in the three shapes a shop actually
  merchandises in: a category rule, a brand rule, or a hand-picked collection.
  Where a product lands is set on the product's own form, next to its categories.
  A section that would resolve to nothing is dropped rather than rendered as an
  empty heading, and "Latest" remains the fallback until the first section
  exists.
- **Like & share (the like half).** Signed-in customers and signed-out visitors
  can both like a product; a visitor's likes follow them into their account on
  sign-in. Counts show in the storefront and on the admin product list, and are
  **hidden at zero** rather than shown as "0". Uniqueness is a partial unique
  index, not a read-then-write, so a double-tapped button on a slow connection
  cannot double-count. Sharing is still outstanding.
- **The customer account.** Customer identity has existed at the service layer
  and behind `api/v1/auth/customer/*` since Phase 3, but **no page reached it** —
  the scope's "Register / sign in (Email or Google)" was built and unreachable.
  There is now register, sign in, password recovery, and a profile carrying
  purchase history, saved products and editable details. Email is deliberately
  not editable and a password change ends every session; both are argued in ADR 0006.
- **Hero copy** moved to `store.hero_headline` / `store.hero_subtitle`, editable
  in Settings, with wording in source as the fallback.
- **`src/proxy.ts`** — Next 16's renamed middleware, added so a signed-out
  request to `/account` gets a real 307 rather than a streamed 200 and a
  JavaScript redirect. It is an optimistic cookie-presence check only; the
  layout still verifies the session server-side. See ADR 0006 §7.

> **A defect found on the way, worth recording.** `savePolicySettingsAction`
> never read `policy.returns`, though the schema required it and the form
> submitted it. Zod rejected every submission for the missing key, so **no policy
> page could be saved from the admin at all** — the form answered "Check the
> form." with nothing visibly wrong. Each settings schema now has an exported
> field list the action builds its submission from, with a test holding the two
> in step, so adding a field can no longer silently break saving it. This was
> live, and it was invisible to typecheck, lint and build alike.

> **Not covered by any automated test.** The admin screens are verified only to
> the extent that they typecheck, build, and redirect a signed-out request. No
> test renders them signed in — that needs the E2E harness, which is the last
> open Phase 3 item. Treat the admin as _implemented_, not _verified in use_.

**Account entry and storefront identity, added 2026-09-02.** Follow-on to the
work above, recorded in
[`decisions/0007-account-entry-and-storefront-identity.md`](decisions/0007-account-entry-and-storefront-identity.md).
No migration.

- **A sign-up now gets a confirmation screen** at `/account/welcome`, carrying
  the `next` destination through, before landing on the account. Google sign-in
  reaches it only for an account it actually created — `loginCustomerWithGoogle`
  and its `api/v1` route now report `created`.
- **The account greets the person using it** by name, from the session row, on
  every screen beneath `/account`. The four destinations became cards; they were
  a rail that scrolled sideways below `sm`, which put "Your details" off the
  right edge of a 360 px screen.
- **The header's user icon moves into the drawer** below `lg` once signed in,
  where it appears as a named row with initials and email. Desktop keeps the icon.
- **The search field takes focus on arrival**, but only when it is empty.
- **A third self-hosted face, Playfair Display**, for the wordmark, the home
  hero, and the footer's oversized `POUCH VILLA`. Never for body copy.
- **The footer carries the delivery attribution** — Bespoke Technologies, its
  mark and website. Deliberately in source, not the settings store: §4 protects
  facts that are the shop's to change, and this is not one of them.

> **A §2 violation found on the way, and fixed.** The storefront scrolled
> horizontally at 320 px, and had done since the header took its fourth control:
> the wordmark plus four 44 px targets do not fit. The wordmark now steps aside
> below 360 px. Measured before and after with a headless browser — 19 px of
> overflow, then none, at 320, 360 and 1280.

**Device finder and the missing notifications, added 2026-09-02.** Two audits,
one change, recorded in
[`decisions/0008-device-finder-and-notifications.md`](decisions/0008-device-finder-and-notifications.md).
No migration.

- **Compatibility became reachable.** The `device` table, the join, the indexes
  and the catalogue filter had existed since migration 0003; the only storefront
  surface was a rail of pills that scrolled sideways, hiding every model past the
  right edge of a 360 px screen. There is now a typed device finder in the home
  hero and above the shop grid, a "fits these phones" block on the product page,
  and a search that recognises a model inside a query like "clear case for
  iphone 13" and offers the filtered shop. One pure matching rule in
  `domain/device-match.ts` serves all three.
- **Eight silent triggers now send.** Payment proof received and rejected, a
  staff alert for a proof waiting, enquiry acknowledgement and staff alert,
  welcome, password changed (both routes to a new password), and review
  moderation outcomes. Bulk order transitions and bulk review moderation notify
  exactly the rows that moved — both services now return the ids rather than a
  count, because neither batch is atomic.
- **`RESEND_EMAIL_SEND_TO` is now read.** It was documented in `.env.example` as
  the operational alert inbox and used by nothing; there was no staff-facing
  email in the system at all. Unset, alerts are skipped silently rather than
  failing the customer action that triggered them.
- **Email is grouped by subject and fired once.** `order-email.ts` had begun
  accumulating account mail; account, enquiry and review messages now have their
  own modules, and the `void send.catch(log)` copied at each call site moved into
  `server/notify.ts`, which logs the error name only — §5 forbids a recipient or
  a proof URL reaching a log.

> **Left undone deliberately.** Staff lifecycle email is now
> [Q11](open-questions.md): a suspension notice is the client's call, and
> emailing a role code would weaken the guarantee `BOOTSTRAP_CEO_EMAIL` exists
> to provide.

Still outstanding for Phase 4: nothing beyond what real operation surfaces.

**Gate:** the client runs a full day of simulated operations entirely from a phone.

### ⏳ Phase 5 — Hardening & launch

Security review against §5 with a written report. Load testing. WCAG 2.2 AA audit including manual keyboard and screen-reader passes. Lighthouse budgets enforced in CI. Backup and **tested restore**. Runbook. Staff training. Pilot, then launch.

**Gate:** a restore drill actually performed and timed; the security report signed off; the client's staff complete their own tasks unaided.

**Started 2026-09-03.** What is done, and what each still needs:

| Item                                  | Status                                                                                                                                                                                  |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Security headers and a strict CSP** | ✅ Built. There were none at all. Nonce-based, no `unsafe-inline`, verified against a real build and pinned by a unit test and the route check.                                         |
| **Security review**                   | ✅ Written — [`security-review.md`](security-review.md). Internal only; **no independent penetration test**.                                                                            |
| **Runbook**                           | ✅ Written — [`runbook.md`](runbook.md).                                                                                                                                                |
| **Accessibility audit**               | ⚠️ [`accessibility-audit.md`](accessibility-audit.md). Automated passes done and one real dark-mode contrast failure fixed. **Manual keyboard and screen-reader passes not performed.** |
| **Lighthouse budgets in CI**          | ⚠️ Running, with the real §2 thresholds, against a CockroachDB service so it measures real pages. **Reports rather than gates** — see below.                                            |
| **Backup and tested restore**         | ❌ Procedure written ([`runbook.md`](runbook.md) §6); **drill not performed**.                                                                                                          |
| **Load testing**                      | ❌ Not performed. Scope in [`security-review.md`](security-review.md) §11.                                                                                                              |
| **Staff training**                    | ❌ Not started. The operating manual is the deliverable.                                                                                                                                |
| **Pilot and launch**                  | ❌ Blocked on an empty catalogue.                                                                                                                                                       |

> **The performance budgets are not met, and the numbers are here rather than
> buried.** Measured 2026-09-03 on the home page, mobile emulation, throttled:
>
> | Metric                   | Measured | §2 budget |
> | ------------------------ | -------- | --------- |
> | Largest contentful paint | 4194 ms  | ≤ 2500 ms |
> | Cumulative layout shift  | 0.025    | ≤ 0.1 ✅  |
> | Total blocking time      | 1197 ms  | ≤ 200 ms  |
> | Script transferred       | 180 KB   | ≤ 120 KB  |
>
> Three of four fail. The Lighthouse job therefore **records** rather than
> blocks: a required check that is red on `main` from the day it is added trains
> everyone to ignore CI. The thresholds in `lighthouserc.json` are the real ones
> and must not be loosened to make the job green — the fix is the app, not the
> budget. The `continue-on-error` flag comes off when they are met.
>
> Part of the LCP figure is this cluster's 2–3 second per-statement latency,
> which load testing should characterise before anyone optimises the wrong thing.
> Total blocking time and script size are client-side and are ours to fix.

---

## 5. Verification as it stands

`pnpm run verify` runs: `format:check` → `lint` → `typecheck` → `check:facts` → `test` → `build` → `test:routes`.

| Layer                 | Coverage                                                                                                                                                                                                                                                       |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Unit**              | Money, role codes, retry classification and backoff, migration checksums, image validation and EXIF stripping                                                                                                                                                  |
| **Integration**       | Against a **live CockroachDB** — role-code redemption, sessions, login lockout, email verification, search                                                                                                                                                     |
| **Permission matrix** | Every role × every permission, asserted allowed _and_ denied                                                                                                                                                                                                   |
| **Business facts**    | A grep gate that self-tests against known-bad samples before it is trusted                                                                                                                                                                                     |
| **Routes**            | Storefront routes return 200; all 14 protected admin routes 307 to `/admin/login`, and the five `/account` routes 307 to `/account/sign-in` — never to the staff login; the API answers its `{ ok }` envelope and refuses a checkout with no `Idempotency-Key` |
| **E2E**               | ❌ Not yet — Phase 3                                                                                                                                                                                                                                           |
| **Accessibility**     | ⚠️ Automated axe on components only; per-route and manual passes are Phase 5                                                                                                                                                                                   |
| **Performance**       | ❌ Lighthouse budgets not yet enforced in CI — Phase 5                                                                                                                                                                                                         |

**Test databases are separate.** Writing integration tests require `TEST_DATABASE_URL` and refuse to run if it matches `DATABASE_URL`. This exists because an early run left twenty-six live role codes in the production database.

> **Correction, 2026-08-31, resolved 2026-09-01.** This table previously claimed _"every protected admin route 307s to `/admin/login`"_ when [`verify-routes.mjs`](../apps/pv-frontend/scripts/verify-routes.mjs) checked no admin route at all. The script now genuinely asserts it, for all thirteen, plus two API contract checks. Output pasted in the Phase 3 gate below.

---

## 6. Risks

| Risk                                   | Impact                                               | Status                                                                                           |
| -------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| **Q2 category mapping unanswered**     | 🟡 Navigation and filters                            | Open. Not blocking: categories are admin rows, so remapping is never a deployment.               |
| **No CEO account claimed**             | 🔴 The admin is unreachable; no data can be entered  | **Blocking.** One CLI command away — see §7.                                                     |
| **Catalogue is empty**                 | 🟠 Nothing for a shopper to see                      | By design — no invented data. Unblocks the moment a CEO claims access and enters real products.  |
| **Manual transfer reconciliation**     | 🟠 Does not scale; staff burden grows with success   | Ship well in V1; propose a payment gateway as a costed later item.                               |
| **Payment-proof exposure**             | 🔴 Financial data leak, reputational and regulatory  | Private bucket and audited signed URLs are designed; built in Phase 3, pen-tested in Phase 5.    |
| **CockroachDB latency**                | 🟡 2–3 s per query even warm, on this cluster        | Absorbed in test timeouts; watch it against the §2 LCP budget once real pages carry real data.   |
| **No E2E harness**                     | 🟠 Flows verified by service tests, not by a browser | Folded into Phase 3, where the flow it would test finally exists.                                |
| **Branch protection unavailable**      | 🟡 `main` is directly pushable                       | GitHub requires Pro for a private repo. Client decision: upgrade, or make the repository public. |
| **Scope creep from "growth features"** | 🟡 Erodes the V1 date                                | The scope's own wording — _"introduced in later phases"_ — is the answer. Log, price, schedule.  |

---

## 7. Immediate next actions

1. **Claim the CEO account.** Nothing else in the admin can happen first, and it is one command:
   ```
   pnpm --filter @pv/backend claim-code --role CEO
   ```
   Redeem the printed code at `/admin/claim`. `BOOTSTRAP_CEO_EMAIL` pins who may redeem it, so the code alone is not enough if it is seen in a terminal or a log.
2. **Enter real catalogue data** through the admin — brands, the two-tier categories, devices, then products with variants, prices, stock and images. The storefront renders it immediately; nothing needs a deploy.
3. **Answer Q2** — the 33-row category mapping, the four orphans, and whether `OtterBox Defender Case` is a brand rather than a category. Recommendation on file: it is a brand.
4. **Decide branch protection** — upgrade to GitHub Pro or make the repository public.
5. **Begin Phase 3.** It depends on none of the above except a populated catalogue for its E2E flow.
