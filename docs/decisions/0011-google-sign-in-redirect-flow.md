<title>ADR 0011 — Google sign-in as a server-side redirect</title>

# ADR 0011 — Dropping Google's widget for an authorization-code redirect

**Date:** 2026-09-03 · **Status:** Accepted · **Builds on:** [`0002-access-and-verification.md`](0002-access-and-verification.md) · **Forced by:** [`AGENTS.md`](../../AGENTS.md) §5

## Context

Sign-in used Google Identity Services: `accounts.google.com/gsi/client` loaded on
every auth page, and `google.accounts.id.renderButton()` drew the button.

That stopped working the day a strict Content Security Policy shipped. Measured
against the live site rather than reasoned about:

```
button inline style: width:320px; max-width:400px; min-width:min-content;   ← blocked
rendered:            448 × 499        logo: 448 × 448
CSP violations:      23
```

GSI builds its button by injecting an **inline `<style>` element** and inline
`style` attributes into our document. Neither can carry our per-request nonce —
Google does not propagate one — and neither is addressable by a hash, because
the values are computed at render time from the container's width. Under §5's
"No `unsafe-inline`" the browser refused them all, so the button rendered
unstyled: a 448px Google logo where a 320px button belonged.

An earlier fix added `style-src-elem https://accounts.google.com`, which let the
stylesheet **download**. It did not help: Google injects that CSS as an inline
`<style>` element, and an origin allowlist cannot authorise inline content.

## The decision

**Stop letting a third party write styles into our document.** Google sign-in is
now a server-side authorization-code redirect, and the button is ours.

The alternative was to allow `'unsafe-inline'` on `style-src-elem` and
`style-src-attr`. Rejected, for three reasons:

1. It weakens a control §5 states without qualification, across every page in
   the application, to accommodate one widget on three pages.
2. Because both directives already carry a nonce or a hash, browsers **ignore**
   `'unsafe-inline'` when it sits beside one. Making it take effect would have
   meant removing the nonce and the `next/image` hash as well — a materially
   larger loosening than it first appears.
3. The redirect flow is simply better: it removes roughly 90KB of third-party
   JavaScript from every sign-in page, and the button matches the rest of the
   interface instead of approximating it.

### What did not change

`loginCustomerWithGoogle`, `loginWithGoogle` and `redeemRoleCode` are untouched.
All three always took an ID token; the token now comes from the code exchange
instead of from a browser SDK. ADR 0002 stands: OAuth authenticates and never
authorises, a Google subject resolves against `customer` **or** `staff` and never
both, and a staff account still exists only where a role code was redeemed.

### The parts that carry the security

- **`state`**, minted per attempt and compared against a cookie with
  `timingSafeEqual`. This is what stops an attacker feeding a victim's browser an
  authorization code they obtained themselves — login CSRF against OAuth.
- **`nonce`**, minted alongside it and bound into the ID token by Google, checked
  in `verifyGoogleIdToken`. A token minted for another flow cannot be replayed
  into this one.
- **The flow is read from the cookie, never the URL.** This route is the one
  place both identity stacks are reachable, so which one a callback lands in must
  not be something a caller can choose.
- **The state cookie is single-use**, cleared before the callback does anything.
- **`SameSite=Lax`, not `Strict`.** A `Strict` cookie is not sent on a cross-site
  navigation, which is exactly what Google's redirect back is; the callback would
  find nothing.

### The role code travels in a POST body

The claim flow needs a role code to survive the round trip to Google. It is
carried in the state cookie, and the button is a **`POST` form rather than a
link** so the code never enters a URL — not the address bar, not browser history,
not a proxy log. Verified: a start request with `roleCode=SECRET-CODE-1234`
produces a redirect URL containing no occurrence of it.

Putting a credential in a cookie deserves justifying. It is `HttpOnly`, `Secure`
in production, host-prefixed, expires in ten minutes, and is deleted the moment
the callback reads it. The alternatives — a URL parameter, or asking the person
to retype the code after returning from Google — are worse and less usable
respectively.

### Failures report through the URL, and say little

The SDK reported errors to an in-page callback. A redirect has none, so the
callback route returns to the originating page with a `?google=` reason that
`GoogleSignInProblem` renders.

The reasons are deliberately coarse. "No staff account for that Google address"
and "that account is suspended" are different facts, and distinguishing them
would let anyone who can reach the URL discover which addresses have accounts.
The server log keeps the error's **name**; §5 forbids its message reaching a log,
because that message can carry an email address.

## Consequences

- **A new Google Cloud Console setting is required.** The callback must be listed
  under **Authorised redirect URIs** on the OAuth client — the JavaScript-origins
  entry the SDK used is not sufficient and does not cover it. Until that is done
  the flow fails at Google with `redirect_uri_mismatch`.
- `googleSignInAction`, `loginWithGoogleAction` and `claimWithGoogle` are deleted.
  Nothing called them once the button changed.
- `verifyGoogleIdToken` takes an optional expected nonce.
- The sign-in pages now load no third-party script at all. Confirmed against a
  built server: zero references to `gsi/client` or `accounts.google.com` in the
  rendered HTML.
- The new-customer welcome redirect was nearly lost in the move. It lived in the
  deleted action, and is now in the callback.

## Verified

Against a production build, not by reading:

| Check                            | Result                          |
| -------------------------------- | ------------------------------- |
| Sign-in page loads Google script | No — 0 references               |
| Start route redirects to Google  | 303, correct params, cookie set |
| Callback with no cookie          | 303 → `?google=expired`         |
| Callback with a forged `state`   | 303 → `?google=mismatch`        |
| Google reporting a cancel        | 303 → `?google=cancelled`       |
| Claim without a role code        | 303 → `?google=nocode`          |
| Role code in the redirect URL    | Absent                          |

**Not verified:** no sign-in has been completed end to end against Google,
because that needs the redirect URI registered in the Cloud Console first.
