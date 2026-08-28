<title>Pouch Villa — Delivery Work Plan</title>

# Delivery Work Plan

**Repository:** `PouchVilla`, cloned from PouchHub at `7c90a80`, 16 commits of provenance retained. Remote now set to `github.com/Kingsley-A1/Pouch-Villa` (empty, nothing pushed yet).
**Standard:** [`../AGENTS.md`](../AGENTS.md) · **Commitment:** [`scope.md`](scope.md) · **Blockers:** [`open-questions.md`](open-questions.md)

---

## 1. Verdict on the inherited codebase

PouchHub is a **1,603-line prototype**, and an honest one — its own documentation states that payments, customer accounts and live stock are *"intentionally out of scope"*. It was built to demonstrate a phone-case storefront, and at that it succeeds.

It is not a foundation for the signed scope, and the gap is not close:

| Scope item | Present in PouchHub |
|---|---|
| Browse, search & filter | ⚠️ Partial — `LIKE '%q%'`, no relevance or index |
| Specs & variants | ❌ A JSON text blob; no per-variant price or stock |
| Like & share | ❌ Absent |
| Add to cart | ❌ **No cart exists** |
| Register / sign in (Email or Google) | ❌ **No customer accounts at all**, by design |
| Place order | ❌ No order or order-line entity |
| Pay by transfer | ❌ Absent |
| Payment proof | ❌ Absent |
| Track order | ❌ Absent |
| Review product | ❌ Absent |
| Contact | ⚠️ A WhatsApp message *preview* that deliberately sends nothing |
| CEO-configurable RBAC | ❌ A hardcoded compile-time map — **structurally cannot** satisfy the scope |
| Orders / Payments / Customers / Reviews admin | ❌ Absent. The "Customers" screen is `GROUP BY` over reservations, not an entity |

Roughly **two of twelve** customer-flow items and **two of eight** admin pages exist in any usable form.

There is also a discovery worth stating plainly: **PouchHub *is* a renamed Pouch Villa prototype.** The database global is `__pouchVillaDb`, the session cookie is `pv_admin_session`, every CSS token is `--pv-*`, the seed account is `admin@pouchvilla.demo`, and `docs/assumptions-and-confirmations.md` opens with *"Pouch Villa is a Calabar-based retailer specialising in phone cases."* The rename to Pouch Hub only ever touched the surface. That is good news for effort and bad news for hygiene — localStorage keys are still `pouch-villa-saved`, `pouch-villa-phone`, `pouch-villa-recent`, which will collide across brands on a shared origin.

**Recommendation: keep the repository, rebuild the substance.** The clone is worth having for its design system, its accessibility discipline, its verification harness and its documentation habit. Those are real and they took time. But the schema, the persistence layer, the auth model and the admin architecture are all load-bearing in the wrong direction, and every one of them is cheaper to replace now than to migrate later.

---

## 2. Keep / Rebuild / Delete

### ✅ Keep and build on

| Asset | Why it earns its place |
|---|---|
| **Design system** (`globals.css`) | Genuinely good. Semantic tokens, fluid `clamp()` type, `:focus-visible` at 3 px, `prefers-reduced-motion`, 44 px minimum button height, deliberate 48 px+ inputs. Retheme the tokens — do not rewrite the system. |
| **Verification harness** | `npm run verify` chaining lint → typecheck → test → build → route-check is exactly the right instinct. Extend it; keep the shape. |
| **Documentation culture** | An assumptions register, a promotion path, an explicit *awaiting confirmation* pattern, and a documented rejection of a bad research package. Rare and valuable. Carried into `docs/`. |
| **The "never invent client data" discipline** | Already the strongest habit in the codebase and now rule #2 in `AGENTS.md`. |
| **Comment quality** | Several comments explain a real past failure and why the fix looks odd. That is the good kind. |
| **Brand identity direction** | Red/white with the case mark is confirmed by the supplied logos. |

### 🔁 Rebuild — right idea, wrong implementation

| Area | Problem | Replacement |
|---|---|---|
| **Persistence** | `node:sqlite`, single global handle, **silent fallback to `:memory:`** on an unwritable path, `/tmp` on serverless — wiped on every cold start. Data loss by design. | CockroachDB, pooled, migration-versioned. No silent fallback: fail loudly. |
| **Product schema** | `variants_json` TEXT. Colour filtering is `variants_json LIKE '%blue%'` — it will match a SKU or a description and silently return wrong results. | Variants as rows with SKU, price, stock. Variant axes as data. |
| **RBAC** | Compile-time `Record<Role, Permission[]>`. | Roles and grants as rows the CEO edits at runtime. |
| **Admin architecture** | Ten screens in one 25-line catch-all `[section]` route, written as minified one-liners. | One route, one file, one test file per section. |
| **Auth** | See §2.1 — several issues, one serious. | Separate customer and staff stacks; server-side revocable sessions. |
| **Media** | Writes to `public/uploads`; throws on Vercel because a runtime-written file is never served. | Direct-to-R2 pre-signed upload. |
| **Search** | `LIKE '%q%'`, unindexable. | Postgres FTS + trigram. |
| **References** | `Math.random()` + 4 digits into a `UNIQUE` column. | CSPRNG with real entropy. |
| **Images** | `unoptimized: true` globally, to dodge a hosting-plan limit. | Proper optimisation; fix the plan, not the code. |

#### 2.1 Auth findings, ranked

1. 🔴 **Deployment-ID-derived signing key.** `src/lib/auth.ts` falls back to `sha256("pouch-villa-session:" + VERCEL_DEPLOYMENT_ID)` when `AUTH_SECRET` is missing. A deployment ID is **not a secret** — anyone who learns it can mint a valid `owner` session. The comment explains it was added to stop sign-in breaking. Understandable under demo pressure; unacceptable in production. **Must not be ported.**
2. 🟠 **Env-var-driven admin credentials, re-applied on every boot.** `applyAdminCredentials` resets the password *and* forces `role='owner', status='active'` on each start. Environment becomes the identity store, and a disabled owner silently re-enables on redeploy.
3. 🟠 **No revocation.** Stateless 8-hour JWT. Removing someone's access requires waiting them out.
4. 🟠 **No login rate limiting.** Open to credential stuffing.
5. 🟡 **Table name interpolated into SQL** in `updateRequestStatus`. Currently safe behind a `z.enum`, but the pattern is one careless edit from an injection.
6. 🟡 **Inconsistent password minimums** — 8 for the seeded owner, 12 for staff created in the UI.

### 🗑️ Delete

Case-compatibility (`find-my-case`, `product_devices`, `devices`, `brands`-as-compatibility, `request-case`), reservations, `back_in_stock_interests`, the WhatsApp-preview flow, all `pouch-villa-*` localStorage keys, all seed data, all PouchHub copy, and `.vercel`/`.openai` host metadata.

> **One caveat, deliberately flagged.** If [`open-questions.md`](open-questions.md) Q1 resolves toward accessories, the device-compatibility model becomes *the* differentiating feature — "show me cases that fit my phone" is exactly what a Pouches & Protection catalogue needs. **Do not delete `product_devices` until Q1 is answered.** The target schema below keeps compatibility as an optional facet precisely so this decision stays cheap.

---

## 3. Target architecture

### The one decision that de-risks everything

The scope says *mobile devices*; the client's live POS says *cases and accessories* ([`client-inputs.md`](client-inputs.md) §4). Rather than guess, the catalogue makes **variant axes data instead of columns**:

```
product
  ├── product_variant          one row per buyable thing — SKU, price, stock
  │     └── variant_value      axis + value  ("storage: 256GB", "colour: Black",
  │                                            "condition: Refurbished — Grade A")
  ├── product_media            R2 keys, ordered, with intrinsic dimensions
  ├── product_category         many-to-many; categories self-reference for the 2-tier tree
  └── product_compatibility    OPTIONAL — links an accessory to devices it fits
```

One schema serves both answers. If they sell handsets, the axes are storage/colour/condition. If they sell cases, the axes are colour/model and `product_compatibility` powers "fits your phone". If they sell both — the likeliest outcome — nothing needs to change. **This costs perhaps a day now and saves a schema migration under deadline later.**

### Other load-bearing choices

- **Stock is an append-only ledger**, not a mutable counter. Quantity is a sum. This is correct under CockroachDB's serializable isolation and transaction retries, where a read-modify-write counter is a live bug, and it gives the client a full stock history for free.
- **Orders snapshot** price, name and variant at placement. A receipt must never change because a price was edited.
- **Money is integer kobo** in a branded type.
- **Permissions are rows.** `role`, `permission`, `role_permission`, all CEO-editable, with the CEO role protected from deletion, demotion, and last-CEO removal.
- **Two identity stacks**, sharing nothing.
- **Service layer is framework-free.** `src/server/services/` imports nothing from `next/*`, so the API and Server Actions are both thin adapters and the POS integration in Q3 has somewhere to land.

---

## 4. Phases

Each phase ends at a **gate**. A gate is not a status update — it is a demo against the acceptance line, with `npm run verify` output pasted.

Durations assume **two engineers**. Confirm team size before treating them as commitments.

### Phase 0 — Foundation *(~1 week)*
Strip PouchHub domain code and branding. CockroachDB connection with retry-aware transactions and forward-only migrations. New `tsconfig` strictness. CI on GitHub Actions: lint, typecheck, test, build, **hardcoded-business-fact grep**, Lighthouse budgets. Staging environment. R2 buckets — public for media, **private for proofs**. Structured logging, error tracking, request IDs.

**Gate:** CI green on an empty app deployed to staging; a migration applied and rolled forward; the hardcoded-fact check demonstrably failing a deliberate violation.

### Phase 1 — Identity & RBAC *(~1.5 weeks)*
Customer auth: email/password + Google OAuth + recovery. Staff auth: separate stack, 2FA, revocable server-side sessions. Roles and permissions as data. CEO bootstrap via an audited command — **never an env var**. Rate limiting. Audit log. Full role × mutation permission matrix test.

**Gate:** the permission matrix test passes in both directions; a CEO changes a manager's permissions in the UI and the change takes effect without a deploy; a revoked session dies immediately.

> Deliberately first. Retrofitting authorisation onto existing features is where security bugs are born.

### Phase 2 — Catalogue & media *(~2 weeks)*
Products, variants, variant axes, categories (2-tier per Q2), brands. Direct-to-R2 upload with pre-signed URLs, magic-byte validation, EXIF strip, derivative generation. Full admin CRUD — create, edit, price, availability, publish/unpublish, soft-delete, restore — **mobile-first**. Postgres FTS + trigram search. Faceted filtering.

**Gate:** on a phone, a staff member creates a product with three variants and four images, edits it, unpublishes it, and deletes it — every step audited; search returns sensible results for a misspelling.

### Phase 3 — Commerce *(~2.5 weeks)*
Cart (guest + authenticated, merged on sign-in). Checkout. Order placement with an **idempotency key**. Bank-transfer instructions from admin settings. Payment-proof upload to the private bucket. Order tracking with the Q6 state machine. Like & share. Reviews with moderation. Contact requests. Transactional email.

**Gate:** the complete scope flow — browse → filter → variant → cart → sign in → order → transfer → proof → track → review — passes E2E on a mobile viewport; a double-submitted order creates exactly one order.

### Phase 4 — Admin operations *(~1.5 weeks)*
All eight scope admin pages as their own routes: Products, Brands/Categories, Orders, Payments & Proofs, Customers, Reviews, Contact Requests, Roles & Permissions. Dashboard. Every list mobile-usable. Supporting pages — About, Privacy, Terms — admin-editable, rendering *awaiting confirmation* until Q10 lands.

**Gate:** the client runs a full day of simulated operations entirely from a phone.

### Phase 5 — Hardening & launch *(~1.5 weeks)*
Security review against §5 with a written report. Load testing. WCAG 2.2 AA audit including manual keyboard and screen-reader passes. Backup and **tested restore**. Runbook. Real data migration from bizblock. Staff training. Pilot, then launch.

**Gate:** a restore drill actually performed and timed; the security report signed off; the client's staff complete their own tasks unaided.

**Indicative total: ~10 weeks with two engineers**, assuming [`open-questions.md`](open-questions.md) Q1 and Q3 are answered before Phase 2 begins.

---

## 5. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| **Q1 unanswered by Phase 2** | 🔴 Schema rework | Axis-as-data model absorbs either answer. Escalate weekly. |
| **Q3 unanswered — dual system of record** | 🔴 Stock drift, staff distrust, silent overselling | Single authoritative ledger now; a documented sync seam. Force the decision before launch, not after. |
| **Refurbished handsets in scope** | 🟠 IMEI, battery health, grading, warranty — unpriced work | Resolve via Q1 and re-quote **before** committing to a date. |
| **CockroachDB transaction retries** | 🟠 Rare, ugly, hard-to-reproduce production bugs | Retry wrapper mandatory in Phase 0; integration tests run against real CockroachDB, never SQLite. |
| **Payment-proof exposure** | 🔴 Financial data leak, reputational and regulatory | Private bucket, signed URLs, access audited, penetration-tested in Phase 5. |
| **Client supplies no real content** | 🟠 A launch with nothing in it | Content deadlines tracked as delivery items with named owners, not as an afterthought. |
| **Manual transfer reconciliation** | 🟠 Does not scale; staff burden grows with success | Ship well in V1; propose payment-gateway integration as a costed Phase 2 item. |
| **Scope creep from "growth features"** | 🟡 Erodes the V1 date | The scope's own wording — *"introduced in later phases"* — is the answer. Log, price, schedule. |

---

## 6. Immediate next actions

1. **Send Q1, Q3, Q4 and Q5 to the client today.** Q1 and Q3 gate the schema; a week of silence is a week of Phase 2 at risk.
2. Create the GitHub repository, push, protect `main`, require PR + green CI.
3. Provision CockroachDB and R2; wire staging.
4. Confirm team size so §4 durations become commitments rather than estimates.
5. Begin Phase 0 — it depends on none of the open questions.

> Phase 0 is deliberately independent of every client answer. Work starts now.
