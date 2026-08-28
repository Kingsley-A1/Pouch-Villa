<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# Pouch Villa Platform — Engineering Standard

Bespoke Technologies won this contract at real cost. The standard is not "it works" — it is **work that is still correct, legible and safe to change in three years**, by an engineer who has never met us.

Read this fully before your first edit. Where this file and your instincts disagree, this file wins. Where this file and the client's signed scope disagree, [`docs/scope.md`](docs/scope.md) wins and this file gets fixed.

**Canonical documents**

| Document | Authority |
|---|---|
| [`docs/scope.md`](docs/scope.md) | What we committed to. Verbatim transcription — never edit to match what we built. |
| [`docs/client-inputs.md`](docs/client-inputs.md) | What the client actually supplied, dated. Evidence. |
| [`docs/open-questions.md`](docs/open-questions.md) | Decisions only the client can make. Check before assuming. |
| [`docs/work-plan.md`](docs/work-plan.md) | Sequenced delivery plan and the reasoning behind it. |
| `AGENTS.md` (this file) | How we build. |

---

## 0. Non-negotiables

Nine rules. Violating any one is a blocking review failure, not a discussion.

1. **No hardcoded business facts.** No phone number, address, email, bank detail, price, opening hour, delivery fee, or policy sentence appears in source. Ever. See §4.
2. **No invented data.** If the client has not supplied it, the UI says so. A plausible placeholder that reaches production is worse than a blank — it becomes a lie the client discovers in front of a customer.
3. **Mobile-first, literally.** Base styles target 360 px. Larger screens are progressive enhancement via `min-width`. See §2.
4. **The server is the security boundary.** Every mutation re-derives identity and authority server-side. UI state is never a permission check. See §5.
5. **Money is integer minor units.** Never a float. Never a `number` that could be either. See §6.
6. **Every mutation is authorised, validated, and audited.** No exceptions for "internal" or "admin-only" paths.
7. **Migrations are forward-only and reviewed.** No destructive change without an explicit, separately-approved step.
8. **Secrets never enter the repo, logs, or error messages.** No credential is ever a default value.
9. **Don't claim it works until you ran it.** Paste the output. See §10.

---

## 1. Stack

Committed. Deviating requires a written decision record in `docs/decisions/`.

| Concern | Choice | Notes |
|---|---|---|
| Framework | **Next.js 16** (App Router) | Read `node_modules/next/dist/docs/` first — see the banner above. Middleware is `proxy` in 16. |
| Language | **TypeScript**, `strict` | See §7 for the settings we tighten beyond the current baseline. |
| Database | **CockroachDB** | Postgres wire protocol — but *not* Postgres. See §3. |
| Object storage | **Cloudflare R2** | All product images, videos, and payment proofs. Never the app filesystem. See §8. |
| Customer auth | **Google OAuth + email/password** with recovery | Scope items 06 and §2 of the scope. |
| Staff auth | **Email/password + mandatory 2FA**, no OAuth | Different threat model. See §5. |
| Source control | **GitHub** | Protected `main`, PR-only, CI green to merge. |
| Styling | **Tailwind v4** + semantic CSS custom properties | Brand values are tokens, not literals. See §2. |
| Validation | **Zod**, one schema per boundary | Shared between API route and form. |

**Runtime rule:** anything touching the database, R2 credentials, or a session runs on the Node runtime, server-side. No database driver, no S3 client, and no secret is ever imported into a Client Component — directly or transitively.

---

## 2. Mobile-first, by default

Pouch Villa's customers are on mid-range Android phones on Nigerian mobile data. That is the *design target*, not the degraded case.

**Layout**
- Base CSS targets **360 px**. Breakpoints only ever widen: `min-width`, never `max-width`.
- Test at 320 px before claiming a layout is done. Nothing may scroll horizontally at any width — wide tables and code blocks scroll inside their own container.
- Interactive targets are **≥ 44 × 44 px** with ≥ 8 px between adjacent targets.
- Respect `env(safe-area-inset-*)`. Primary actions sit within thumb reach on tall screens.

**Performance budget** — enforced in CI, measured on a throttled mid-tier Android profile:

| Metric | Budget |
|---|---|
| LCP | ≤ 2.5 s |
| INP | ≤ 200 ms |
| CLS | ≤ 0.1 |
| JS shipped to a first-visit product page | ≤ 120 KB gzipped |

- Server Components by default. `"use client"` needs a reason you can state in one sentence.
- Every image goes through `next/image` with explicit `sizes`. Never `unoptimized` — that was a PouchHub workaround for a hosting-plan limit and must not be carried forward.
- No client-side data fetching for content that could have been rendered on the server.

**The admin is mobile-first too.** The client explicitly asked to run the business from a phone. An admin table that is only usable on a desktop is an incomplete feature — every list gets a card layout below `md`, and every destructive action gets a confirmation that is reachable with one thumb.

**Accessibility: WCAG 2.2 AA is the floor.** Semantic HTML first, ARIA only when semantics genuinely run out. Every input has a real `<label>`. Focus is always visible. Colour never carries meaning alone. Every flow completes on keyboard alone. Honour `prefers-reduced-motion`.

---

## 3. API-first

Every capability is an HTTP endpoint with a typed contract **before** any UI consumes it. The web app is the first client, never the privileged one.

**Why this is a rule here:** the client already runs a POS ([`docs/open-questions.md`](docs/open-questions.md) Q3). A sync, a stock reconciliation, or a mobile app will be asked for. Business logic reachable only through a React form is business logic that must be rewritten to serve them.

- Route handlers under `app/api/v1/…`. **Versioned from the first commit** — retrofitting a version prefix after third-party consumers exist is a breaking change.
- Every endpoint: Zod-validated input, typed output, documented errors. The Zod schema is the single source of truth — the OpenAPI document is generated from it, never hand-maintained.
- Server Actions are permitted for form submissions, but they are a **thin adapter** over the same service function the route handler calls. Business logic lives in `src/server/services/`, which imports nothing from `next/*`. If logic exists only inside an action, that is a defect.
- Errors are a discriminated union. No throwing strings. No leaking a driver error to a client.
- Idempotency keys on order placement and payment-proof submission. Nigerian mobile data drops mid-request; a double-submitted order is a real, foreseeable loss.
- Pagination is cursor-based. No unbounded list endpoint, internal ones included.

**CockroachDB specifics — read before writing a query.** It speaks the Postgres wire protocol but is a distributed database:

- Use `UUID`/`gen_random_uuid()` for primary keys. **Never a sequential integer** — it creates a write hotspot on a single range. PouchHub's `INTEGER PRIMARY KEY AUTOINCREMENT` does not survive the port.
- Transactions can be **retried by the server**. Every transaction must be wrapped in retry-aware handling and its body must be safe to run twice. This is not optional and it is the single most common way teams get CockroachDB wrong.
- `SELECT … FOR UPDATE` behaves differently under serializable isolation. Model stock as an **append-only ledger**, deriving quantity from a sum, rather than mutating a counter under a lock.
- Prefer one round trip to many. Latency is per-statement and distributed.
- Schema changes are online and asynchronous — a migration returning does not mean the change is fully propagated.

---

## 4. No hardcoded business facts

The most-repeated instruction from the client, and the rule most likely to be quietly broken under deadline.

**Forbidden in source, in any form:**
phone numbers · WhatsApp numbers · email addresses · street addresses · opening hours · bank account details · prices · delivery fees · tax rates · policy or legal wording · social handles · staff names · category lists · brand names.

**Where they live instead:** an admin-editable settings store, seeded empty, with a typed key registry. Reading an unset setting returns a *typed absence*, never an empty string that renders as a blank space where a phone number should be.

**Environment variables are for infrastructure, not business facts.** A database URL is infrastructure. A WhatsApp number is a business fact and belongs in the admin UI where a non-engineer can change it on a Sunday without a deployment. PouchHub put the store address in `NEXT_PUBLIC_STORE_ADDRESS`; do not repeat that.

**Enforcement:** CI greps for Nigerian phone patterns, email literals, `wa.me`, and currency literals outside the settings module and seed fixtures. The check fails the build. Test fixtures are exempt and must live under `tests/`.

Seed data is **clearly fictional and clearly labelled**, and no seed path ever runs against production.

---

## 5. Security

**Two separate identity systems.** Customers and staff share no session, no cookie, no table, and no code path. A privilege bug in the storefront must not be able to reach the admin.

**Sessions**
- Server-side session records with a **revocation list**. A stateless JWT that cannot be revoked is not acceptable for staff access — firing someone must end their access immediately.
- Signing keys come from a real secret. **Never derive a key from a deployment ID, commit SHA, or hostname** — those are not secrets. (PouchHub does this. It is a session-forgery risk and it must not be copied.)
- Cookies: `HttpOnly`, `Secure`, `SameSite=Lax`, host-prefixed. Rotate the session ID on privilege change and on sign-in.
- Idle and absolute timeouts. Staff sessions are short.

**Authorisation** — the scope's three layers, kept genuinely distinct:
1. *Authentication* — who are you?
2. *Authorisation* — may you perform this action on this object? Enforced in the service layer, never in a component.
3. *Role-based access* — admin only, and **CEO-configurable at runtime**.

> The scope says *"CEO controls manager and employee permissions"*. That makes permissions **data**, not a compile-time constant. PouchHub's hardcoded role→permission map cannot satisfy this and must not be ported. Roles and grants are database rows the CEO edits; the CEO role itself is not editable and cannot be deleted or demoted by anyone, including itself. Guard against removing the last CEO.

**Always**
- Rate-limit authentication, password reset, payment-proof upload, and review submission. Per-IP and per-account.
- Passwords: Argon2id, minimum 12 characters, checked against a breach list. One minimum, applied everywhere — PouchHub had 8 in one place and 12 in another.
- Never interpolate a table or column name into SQL, even behind an enum guard. Use a lookup that maps to a distinct prepared statement.
- Uploads: verify magic bytes, not the declared MIME type or extension. Strip EXIF. Cap size. Serve from R2 via short-lived signed URLs — never from an app-served path.
- Payment proofs are financial documents containing bank details. **Private bucket, signed URLs, access logged, never public.**
- Security headers including a strict CSP. No `unsafe-inline`.
- Every privileged mutation writes an audit record: actor, action, entity, before/after, timestamp, request ID. Audit records are append-only.

**Never** log or put in an error message: a password, token, session ID, full bank detail, or payment-proof URL.

---

## 6. Data and money

- **Money is an integer count of kobo**, with an explicit currency, in a branded type that will not accept a bare `number`. Never a float, never `demo_price`.
- Rounding is explicit and stated at every boundary.
- An order **snapshots** the price, product name, and variant at placement time. It never joins to live product data for a historical figure — a customer's receipt must not change because someone edited a price.
- Timestamps are `TIMESTAMPTZ`, stored UTC, rendered in Africa/Lagos. Never a string.
- Variants are **first-class rows** with their own SKU, price and stock. Never a JSON blob — PouchHub's `variants_json` cannot be indexed, filtered or stock-tracked, and its colour filter is a substring match that silently matches SKUs. Variant *axes* are data, so the same schema serves storage/colour/condition and colour/size alike ([`docs/open-questions.md`](docs/open-questions.md) Q1).
- Search is a real Postgres full-text index with trigram fuzzy matching. Not `LIKE '%q%'`.
- Every foreign key has an index. Every list query has a bounded result set.
- **Nothing is hard-deleted.** Products, orders, customers and reviews soft-delete with an actor and reason.
- Order references are generated from a **cryptographic** random source with enough entropy to make collisions negligible. PouchHub uses `Math.random()` with four digits; at real order volume that collides, and the column is `UNIQUE`, so it fails the customer's checkout.

---

## 7. Code standards

**Structure**

```
src/
  app/            Routes. Thin. Composition and data loading only.
    api/v1/       Versioned HTTP API — the contract.
  server/
    services/     Business logic. Imports nothing from next/*. Unit-testable.
    db/           Schema, migrations, typed queries.
    auth/         Session, permission evaluation.
  components/     Presentational. No data fetching, no business rules.
  lib/            Pure, dependency-free helpers.
```

**Rules**
- **One exported concern per file.** PouchHub's `app/admin/(protected)/[section]/page.tsx` packs ten admin screens into a single catch-all route as minified one-line components. It demos well and it is unmaintainable. Every admin section is its own route, its own file, its own tests.
- **Write for the reader.** Dense single-line components are a defect regardless of what the formatter allows. Line length ≤ 120. Formatting is Prettier's job, not a matter of taste.
- Comments explain **why**, never what. A comment restating the code is deleted.
- No `any`. No non-null `!` — narrow properly. No `as` except at a validated boundary.
- Names say what a thing is. No `data`, `item`, `handleClick2`, `temp`.
- Delete dead code. Git remembers it.

**TypeScript — tighten beyond the inherited baseline.** The cloned `tsconfig.json` is Next's default; add `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noFallthroughCasesInSwitch`, and raise `target` past ES2017.

**Every PR** is single-purpose, has a green CI, describes what a reviewer should look at, and includes tests. Conventional Commits. `main` is always deployable.

---

## 8. Media (Cloudflare R2)

- Every product image and video, and every payment proof, lives in R2. **Never the application filesystem** — PouchHub writes uploads to `public/uploads`, which cannot work on a serverless host and fails at runtime.
- Uploads go **direct to R2 from the browser via a pre-signed URL** issued by an authorised endpoint. Bytes do not pass through the application server.
- Public product media: public bucket via CDN, immutable content-hashed keys, long cache TTL.
- Payment proofs: **private bucket**, short-lived signed URLs, every access audited.
- Derivatives (thumbnail, card, hero, AVIF/WebP) are generated on upload, not per request. Store intrinsic dimensions so every image renders with a reserved box and contributes nothing to CLS.
- Deleting a product does not orphan its objects — media lifecycle is explicit and reconciled by a scheduled job.

---

## 9. Testing

Tests assert behaviour a customer or staff member would notice. Coverage percentage is not a goal.

**Required**
- **Unit** — every service function, especially money, stock, permission evaluation, and state transitions.
- **Integration** — every API endpoint against a real CockroachDB instance. Not SQLite, not a mock; the retry semantics are the point.
- **Permissions** — an explicit matrix test. For every role × every mutation, assert allowed *and* denied. This is the test that keeps the client's business safe.
- **E2E** — the full commerce flow from the signed scope: browse → filter → variant → cart → sign in → order → transfer → proof → track → review. On a mobile viewport.
- **Accessibility** — automated axe on every route, plus a documented manual keyboard pass per release.
- **Performance** — Lighthouse CI against the §2 budgets, failing the build.

**Every bug fix starts with a failing test that reproduces it.** No exceptions. A fix without a regression test is an invitation to fix it again.

---

## 10. Truthful reporting

The client is paying for a system they will run their business on. Overstated progress is the fastest way to lose that trust.

- **Never say "done", "works", "passing" or "fixed" without having run the thing and seen the output.** Paste it.
- If a test fails, say so and show it. If you skipped something, say what and why.
- If you are blocked, say what you need. Do not build a plausible guess around a missing answer — check [`docs/open-questions.md`](docs/open-questions.md) and add to it.
- Distinguish "implemented" from "implemented, tested, and verified in a deployed environment". They are different claims and only the last one means the client can use it.
- If you discover something that makes a committed scope item wrong or risky, raise it immediately, in writing, with a recommendation. Discovering it late is far more expensive than being wrong early.

**Definition of done**, all of it, every time:

Behaviour matches the scope · tests written and green · `npm run verify` clean · works at 360 px · keyboard and screen-reader passable · authorised server-side · audited · no hardcoded business fact · docs updated · reviewed by someone who did not write it.
