<title>Pouch Villa — Security Review</title>

# Security Review

**Date:** 2026-09-03 · **Reviewed against:** [`../AGENTS.md`](../AGENTS.md) §5
· **Reviewer:** Bespoke Technologies · **Status:** internal review complete;
**no independent penetration test has been performed**

This is the written report AGENTS.md §5 and the Phase 5 gate require. It states
what was checked, what holds, what does not, and what was deliberately accepted.

**What this is not.** It is a review by the team that wrote the code, against
its own standard. It is not an adversarial test by an outside party, and it does
not substitute for one before the platform carries real money at volume. Where a
control is designed but unproven in use, this document says so rather than
claiming it works.

---

## 1. Summary

| Area                                | Verdict                                                   |
| ----------------------------------- | --------------------------------------------------------- |
| Identity separation                 | ✅ Holds — no shared session, cookie, table or path       |
| Session management                  | ✅ Server-side, revocable, rotates on privilege change    |
| Password handling                   | ✅ Argon2id, one 12-character minimum, breach-checked     |
| Authorisation                       | ✅ Enforced in services; matrix-tested both ways          |
| SQL injection                       | ✅ No identifier interpolation anywhere                   |
| Transport and headers               | ✅ Strict CSP with no `unsafe-inline`; HSTS; nosniff      |
| Audit trail                         | ✅ Append-only, redacting, written in-transaction         |
| Payment-proof confidentiality       | ⚠️ Designed correctly; **never tested with a real proof** |
| Rate limiting                       | ✅ Database-backed, per-IP and per-account                |
| Media upload safety                 | ✅ Magic bytes, EXIF stripped, size capped                |
| Dependency supply chain             | ⚠️ Lockfile policy check only; no scheduled scanning      |
| Penetration testing                 | ❌ Not performed                                          |
| Accessibility as a security concern | ⚠️ `color-contrast` currently failing                     |

**Nothing found in this review is a live exploitable vulnerability.** The gaps
are unproven controls and missing external validation, not open doors.

---

## 2. The two identity stacks

**Requirement.** Customers and staff share no session, no cookie, no table and
no code path. A privilege bug in the storefront must not reach the admin.

**Verified.** Separate tables (`staff`, `customer`), separate session tables,
separate cookies (`pv_staff_session`, `pv_customer_session`), separate adapters
(`server/session.ts`, `server/customer-session.ts`). Neither adapter imports the
other. A Google subject is resolved against one table or the other, never both.

**The route check asserts the boundary from outside**: every protected admin
route redirects to `/admin/login` and every account route to
`/account/sign-in` — and it fails the build if an account route ever redirects
into the staff login, which would be the first visible sign the two had begun to
merge.

**Google authenticates and never authorises.** It may create a _customer_
account, because a customer account carries no authority. It cannot create a
staff account, cannot pick a role, and cannot raise one: a staff account exists
only where a role code was redeemed, and the role is whatever that code carried.

**Accepted risk.** Customer email is unverified by design
([`decisions/0002`](decisions/0002-access-and-verification.md)). The consequence
is stated rather than hidden: email is a contact channel, not an identity proof,
so order tracking is authorised by the order reference **plus the registered
phone**, never by email alone.

---

## 3. Sessions

- **Server-side records with revocation.** A stateless JWT that cannot be revoked
  was rejected: firing someone must end their access immediately, and it does —
  suspension revokes every session in the same transaction as the status change.
- **Signing keys come from a real secret.** Production refuses to start without
  `AUTH_SECRET`. The prototype derived a key from a deployment ID; that is a
  session-forgery risk and the code path is deleted.
- **Cookies** are `HttpOnly`, `Secure` in production, `SameSite=Lax`, and
  host-prefixed with `__Host-` where HTTPS makes that possible.
- **The session id rotates on sign-in.** A fresh row is issued rather than an
  existing one reused.
- **Staff sessions are short** with idle and absolute timeouts. Customer sessions
  are 30 days absolute with no idle timeout — a shopper is not a threat model,
  and signing someone out mid-checkout on mobile data is a lost order.
- **A password change ends every session, including the current one.** A password
  change is what someone does when they think an account is compromised; leaving
  the intruder's session alive would make the act pointless.

---

## 4. Authorisation

**Permissions are data, not a compile-time map.** The prototype's hardcoded
`Record<Role, Permission[]>` structurally could not satisfy the signed scope's
"CEO controls manager and employee permissions". Roles and grants are rows the
CEO edits at runtime.

**Two permissions are CEO-only and cannot be delegated:** `role.manage` and
`staff.manage`. Whoever can edit grants can grant themselves anything, and
whoever can manage staff can create a CEO. The CEO role itself cannot be edited,
deleted or demoted, and the system refuses an action that would remove the last
CEO.

**Enforced in the service layer**, never in a component. UI state is never a
permission check; a hidden button is a courtesy, not a control.

**Tested in both directions.** The permission matrix asserts every role against
every permission, allowed _and_ denied. A test that only checks the allowed half
would pass a system that grants everything to everyone.

---

## 5. Injection and data handling

**No identifier is ever interpolated into SQL**, even behind an enum guard. The
prototype did this and that code path is deleted. Where a shared helper must work
across tables, it takes a callback holding that table's own literal statement —
`domain/slug.ts` is the worked example, and the comment there says why.

All values are parameterised. Search uses full-text and trigram indexes, not
`LIKE '%q%'`.

**Rendered content is never trusted HTML.** Staff-authored policy text goes
through `components/policy-page.tsx`, which parses to React nodes and has no
`dangerouslySetInnerHTML`. Markdown links are allowlisted to internal paths only:
a `[text](https://evil.example)` in a setting renders as text, not a link. This
was verified by injecting hostile values into a live setting and reading the
output, not by reading the code.

The one `dangerouslySetInnerHTML` in the codebase is `JSON.stringify` of an
object we construct, for breadcrumb structured data.

---

## 6. Transport, headers and the Content Security Policy

Added 2026-09-03. **There were no security headers at all before that**, which
was the most serious gap against §5 in the system.

```
default-src 'self';
script-src 'self' 'nonce-…' 'strict-dynamic';
style-src 'self' 'nonce-…';
style-src-attr 'unsafe-hashes' 'sha256-…';
img-src 'self' blob: data: <media origin>;
font-src 'self';
connect-src 'self' https://accounts.google.com <r2 origins>;
frame-src https://accounts.google.com;
object-src 'none'; base-uri 'self'; form-action 'self';
frame-ancestors 'none'; upgrade-insecure-requests
```

Plus `Strict-Transport-Security` (two years, subdomains, preload),
`X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`,
`Permissions-Policy` denying camera, microphone, geolocation and payment, and
`Cross-Origin-Opener-Policy: same-origin-allow-popups`.

**No `unsafe-inline`, anywhere.** Scripts are trusted by a per-request nonce
minted in `proxy.ts`. Verified against a real build: all 29 script tags in the
rendered home page carry the nonce, and there are no un-nonced inline styles.

**One documented exception.** `next/image` emits `style="color:transparent"` on
every image. Rather than allow inline styles wholesale, exactly that declaration
is permitted by SHA-256 hash under `style-src-attr`. `'unsafe-hashes'` applies a
hash to an attribute; it grants no ability to run script, and it appears nowhere
near `script-src`.

**COOP is `same-origin-allow-popups`, not `same-origin`.** The stricter value
severs Google sign-in's popup from its opener and the button fails with nothing
useful said. The weaker value still isolates this page from any site that opens
it. This is a deliberate, narrow trade.

A unit test pins the policy and fails if `'unsafe-inline'` reappears; the route
check asserts the header is actually served and that every script is nonced.

---

## 7. Uploads and payment proofs

**Product media.** Uploaded direct to R2 from the browser with a pre-signed URL
issued by an authorised endpoint — bytes never pass through the application
server. Files are verified by **magic bytes**, not by declared MIME type or
extension. EXIF is stripped by re-encoding. Size is capped. Derivatives are
generated on upload, from immutable content-hashed keys.

**Payment proofs are financial documents containing bank details.** They live in
a **separate private bucket**, are served only through short-lived signed URLs,
and every access is audited. No proof URL is ever logged or put in an error
message.

**⚠️ Unproven.** No real payment proof has been uploaded, stored, signed for and
retrieved in production. The design is right and the code path is tested at the
service level, but the end-to-end confidentiality of a real document has not been
demonstrated. **This should be exercised before the platform takes real money.**

---

## 8. Rate limiting and abuse

Database-backed counters, not an in-memory bucket: memory does not survive an
instance recycling, and an attacker who can cause one can reset an in-memory
limit. Applied per-IP **and** per-account, because either alone leaves a hole.

Covered: customer login, sign-up, password reset, payment-proof upload, review
submission, contact submission, order tracking, order placement, admin search,
product likes.

Staff login is deliberately different: it counts failures out of the audit trail,
because a staff login failure genuinely is an auditable security event worth
keeping. An anonymous review submission is not, and writing every one into an
append-only trail would bury the records staff actually read.

**Enumeration is closed** on the paths that matter. Password reset always reports
success. A password attempt against an account that has no password hash — one
created at checkout or through Google — fails exactly as a wrong password does.
Role-code rejection is uniform: telling a caller whether a code exists or merely
expired tells someone probing which codes are real.

---

## 9. Audit trail

Every privileged mutation writes a record — actor, action, entity, before, after,
timestamp, request id — **in the same transaction as the change**, so a committed
change always has its record and a rolled-back one leaves none.

Records are append-only. There is no update and no delete path, here or anywhere.

**Redaction happens centrally**, not at each call site, so forgetting is not
possible: `password`, `password_hash`, `token`, `token_hash`, `code`,
`code_hash`, `totp_secret`, `secret`, `authorization` and `cookie` are replaced
before the record is written.

---

## 10. What is not done

| Gap                                               | Risk                                                | Recommendation                                  |
| ------------------------------------------------- | --------------------------------------------------- | ----------------------------------------------- |
| **No independent penetration test**               | Unknown unknowns; this review is by the authors     | Commission one before real trading volume       |
| **Payment-proof path never exercised end to end** | The one path handling financial documents           | Exercise it in a controlled test before launch  |
| **No load testing**                               | Behaviour under concurrency is unmeasured           | See §11                                         |
| **No dependency vulnerability scanning**          | A known CVE could sit unnoticed                     | Enable Dependabot or equivalent on a schedule   |
| **`color-contrast` failing**                      | A WCAG 2.2 AA failure, and an accessibility barrier | Fix before launch; it is now asserted in CI     |
| **No manual keyboard or screen-reader pass**      | Automated checks miss most real barriers            | Perform and record before launch                |
| **Branch protection unavailable**                 | `main` is directly pushable                         | Upgrade the GitHub plan or make the repo public |
| **No restore drill performed**                    | A backup nobody has restored is a hope              | [`runbook.md`](runbook.md) §6.3                 |

---

## 11. Load testing

**Not performed.** What to measure, when it is done:

- **Concurrent checkout of the same variant.** The stock ledger and the
  idempotency key are the controls; the assertion is that oversell is impossible
  and that a retried request creates exactly one order. The single-request case
  is already covered by an integration test against a live database, including a
  racing double submission.
- **Sustained browse traffic** against the catalogue, watching the §2 LCP budget
  with real query latency rather than an empty database.
- **Transaction retry behaviour** under contention. CockroachDB retries
  serialisable conflicts server-side; the concern is whether the retry loop's
  backoff holds up when many writers contend, not whether it is correct.

**Correction, 2026-09-03, same day.** This section previously stated the
cluster's per-statement latency was "the dominant factor in every page timing
measured so far." That claim rested on a local measurement that was itself
wrong — see the correction in [`work-plan.md`](work-plan.md) §4. Google's own
PageSpeed Insights against the live production site measures LCP at 2.6 s with
a 97/100 performance score, which does not support a 2–3 second bottleneck on
the pages it tested. Whether per-statement latency matters under concurrent
load — many simultaneous writers contending for the same rows — is still
unmeasured and is exactly what load testing should establish; it should not be
assumed from a single-request page load.

---

## 12. Sign-off

| Role               | Name                 | Date       | Signature                |
| ------------------ | -------------------- | ---------- | ------------------------ |
| Reviewing engineer | Bespoke Technologies | 2026-09-03 | Internal review complete |
| Independent tester | —                    | —          | **Not performed**        |
| Client acceptance  | Pouch Villa          | —          | Pending                  |

This document should be re-reviewed whenever the authentication, authorisation,
payment or upload paths change, and at minimum before launch.
