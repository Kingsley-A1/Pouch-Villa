<title>ADR 0002 — Access, verification and the 5-minute order</title>

# ADR 0002 — Access, verification and the 5-minute order

**Date:** 2026-08-30 · **Status:** Accepted · **Client decisions:** [`../open-questions.md`](../open-questions.md) Q5, Q6, Q9

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
- **An order creates the account.** Checkout carries a _Create my Pouch Villa
  account_ checkbox, ticked by default. The customer appears in the admin
  immediately and gets `/profile` — an addition to the signed scope, logged as such.
  The checkbox is a real choice: unticking it places the order without an account,
  and the ticked default is recorded as consent with a timestamp, which is the
  distinction that matters under NDPR between a default and a silent creation.
- **No email verification for customers.** Nothing about ordering depends on proving
  the address, and an inbox round-trip in the middle of checkout is the single most
  expensive step we could add.
- Because the address is unverified it is **not** an identity proof. Order tracking
  is authorised by the order reference plus the registered phone number, never by
  email alone.

### 2. Staff: code-based, and nothing is seeded

No CEO, manager or employee email is seeded, and no credential comes from an
environment variable. Access is granted by codes:

- **Three codes for three levels — CEO, Manager, Employee — and nothing more.** A
  code carries exactly one role. There is no fourth tier and no per-account
  override; anything finer is expressed as permissions on the role, which the CEO
  edits at runtime.
- **CEO bootstrap.** An audited CLI command mints a single-use, short-expiry CEO
  code and writes an audit record. Whoever redeems it at `/admin/claim` becomes CEO
  and sets their own credentials. It cannot be redeemed twice.
- **Staff invitation.** The CEO mints Manager and Employee codes in the admin UI,
  each with an expiry, a use count and a revoke switch.
- **Only the hash is stored.** Reading the database does not yield a working code;
  the plaintext exists once, in the output of the command that minted it. Codes use
  a 31-character alphabet with `O`, `I`, `L`, `0` and `1` removed, because these get
  read off a screen and typed on a phone.
- **Email verification is code-based, not link-based.** A one-time numeric code is
  entered in the app. Magic links are not used: they leak through shared inboxes and
  forwarded mail, break in in-app browsers, and are phishable in a way a code typed
  into a page the user already has open is not.
- **Google sign-in is available to everyone, staff included — CEO as well.** The
  client was shown the objection and reaffirmed the requirement, so it is settled.
  This overrides `AGENTS.md` §5's "no OAuth for staff", and §5 has been amended
  rather than left contradicting the build.

  What makes it acceptable is that **OAuth authenticates, it does not authorise**.
  Signing in with Google proves control of a mailbox and nothing else. It cannot
  create a staff account, cannot choose a role, and cannot raise one. An account
  exists only where a role code was redeemed, and the role is whatever that code
  carried. A stranger who signs in with Google and holds no code is simply a
  customer.

  The separate-stacks rule survives where it matters: staff and customers still
  share no session, no cookie, no table and no code path. A Google identity that
  resolves to a customer can never resolve to a staff member; the two lookups are
  against different tables and the subject is unique within each.

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
