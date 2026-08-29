<title>ADR 0002 — Access, verification and the 5-minute order</title>

# ADR 0002 — Access, verification and the 5-minute order

**Date:** 2026-08-29 · **Status:** Accepted · **Client decisions:** [`../open-questions.md`](../open-questions.md) Q5, Q6, Q9

## Context

The client's goal is that someone who has just found Pouch Villa can complete an
order in about five minutes, with no unnecessary step — without weakening access
control on the admin side. Those pull in opposite directions, so the two identity
systems get opposite treatments.

## Decisions

### 1. Customers: an account, but exactly one screen

Scope item 06 places _Register / Sign In_ before _Place Order_, and that ordering is
kept — no scope amendment is needed. What is removed is everything around it:

- One screen: email and password, or Google. No confirmation step, no second page.
- **No email verification for customers.** Nothing about ordering depends on proving
  the address, and an inbox round-trip in the middle of checkout is the single most
  expensive step we could add.
- Because the address is unverified it is **not** an identity proof. Order tracking
  is authorised by the order reference plus the registered phone number, never by
  email alone.

### 2. Staff: code-based, and nothing is seeded

No CEO, manager or employee email is seeded, and no credential comes from an
environment variable. Access is granted by codes:

- **CEO bootstrap.** An audited CLI command mints a single-use, short-expiry claim
  code and writes an audit record. Whoever redeems it at `/admin/claim` becomes the
  CEO and sets their own email and password. It cannot be redeemed twice.
- **Staff invitation.** The CEO mints invite codes in the admin UI. Registration
  requires the code, an email and a password — the 8-digit gate from Q5.
- **Email verification is code-based, not link-based.** A one-time numeric code is
  entered in the app. Magic links are not used: they leak through shared inboxes and
  forwarded mail, break in in-app browsers, and are phishable in a way a code typed
  into a page the user already has open is not.
- Staff keep mandatory 2FA and no OAuth, per `AGENTS.md` §5. Q5's answer asked for
  Google sign-in on staff accounts; that conflicts with the separate-stacks rule and
  is **still open with the client** — see [`../open-questions.md`](../open-questions.md).

### 3. Sessions fail closed

The inherited deployment-ID-derived signing key is removed rather than renamed. A
production environment without `AUTH_SECRET` now refuses to start instead of signing
sessions with a value anyone can discover. No default credential is seeded in any
environment, and one password minimum — 12 characters, in
`@pv/backend/auth/password` — applies everywhere.

## Consequences

- Customer email is a contact channel, not an authentication factor. Anything
  security-bearing sent there must carry its own proof.
- Losing the last CEO claim code means minting another from the CLI, which requires
  environment access. That is the intended blast radius.
- The five-minute target is a measurable acceptance criterion, tested E2E on a
  mobile viewport, not an aspiration.
