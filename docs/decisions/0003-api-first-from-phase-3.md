<title>ADR 0003 — API-first, from Phase 3</title>

# ADR 0003 — Every Phase 3 capability is an HTTP endpoint

**Date:** 2026-08-31 · **Status:** Accepted · **Amends:** `AGENTS.md` §3, [`0001-workspace-split.md`](0001-workspace-split.md)

## Context

`AGENTS.md` §3 says every capability is an HTTP endpoint with a typed contract
**before** any UI consumes it, under `app/api/v1/…`, _"versioned from the first
commit"_. [`0001`](0001-workspace-split.md) lists `src/app/ routes, and api/v1 from
Phase 0`. [`../work-plan.md`](../work-plan.md) §3 lists `api/v1/` in the
architecture-as-built block.

None of that was true. At the close of Phase 2 the app contained **no route
handlers at all**:

```
$ find apps/pv-frontend/src/app -type d -name "api*"   → (nothing)
$ find apps/pv-frontend/src -name "route.ts"           → (nothing)
```

Phases 0–2 shipped entirely on Server Actions. Three documents described an API
that did not exist, which is exactly the kind of drift §10 exists to prevent, so
this record states what happened and what changes.

**Why it was survivable until now.** The rule's real purpose is that business
logic must not be reachable only through a React form. That purpose was met by a
different mechanism: [`0001`](0001-workspace-split.md)'s package boundary. Every
service lives in `@pv/backend`, imports nothing from `next/*`, and is called by
actions that are already thin. No logic has to be _rewritten_ to serve a second
client — only exposed.

**Why it stops being survivable in Phase 3.** The capabilities Phase 3 adds are
precisely the ones a second client needs first: order placement carrying an
idempotency key, payment-proof presigning, stock reconciliation against the POS
that [`../open-questions.md`](../open-questions.md) Q3 anticipates. A Server
Action cannot serve any of them — it is invoked by a React runtime protocol, not
a documented HTTP contract, and it has no stable URL, no versioning and no
schema a third party can read.

## Decision

**Every capability introduced from Phase 3 onward ships as an HTTP endpoint
first.** The order is fixed:

1. A Zod schema in `@pv/backend/domain/schemas` — one per boundary.
2. A service function in `@pv/backend/services/…` that owns the logic.
3. A route handler under `app/api/v1/…` that validates with the schema, calls the
   service, and returns a typed result or a documented error.
4. Only then, where a form needs one, a Server Action that is a **thin adapter
   over the same service function** — never over the route handler, and never
   holding logic of its own.

Step 4 is optional. Steps 1–3 are not.

**Errors are a discriminated union** shaped `{ ok: true, data }` or
`{ ok: false, error: { code, message, details? } }`, with `code` drawn from a
closed set. A driver error never reaches a client; the existing
[`toActionError`](../../apps/pv-frontend/src/lib/action-state.ts) reasoning —
only an error that named itself is safe to show — is applied at the HTTP boundary
too.

**Catalogue and admin endpoints are backfilled in Phase 4**, not Phase 3. Those
capabilities already work through actions; retrofitting them now would delay the
commerce flow the client is waiting on, and the services are unchanged either way
so the backfill is additive. This is a scheduling choice, recorded so it is not
mistaken for a decision to leave them out.

## Consequences

- `AGENTS.md` §3's _"versioned from the first commit"_ is not recoverable and is
  now false as written. It is amended to _"versioned from ADR 0003"_. The `/v1`
  prefix is in place before any third-party consumer exists, which is what the
  rule was actually protecting.
- Phase 3 costs roughly 15–20% more than an action-only build. That is paid once.
- The OpenAPI document is generated from the Zod schemas, never hand-maintained.
  Until it is generated, an endpoint's schema is its contract.
- A capability with a route handler and no UI is normal and correct here. It is
  not dead code, and it is not deleted under §7's dead-code rule.
