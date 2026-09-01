# Admin Shell and Email Polish

**Status:** Approved
**Date:** 2026-09-01

## Scope

Deliver one isolated release from `origin/main` that improves the desktop admin sidebar, adds
password visibility controls to staff authentication, strengthens the existing auth-panel corner
accent, and gives every transactional email a shared professional presentation. The dirty primary
worktree and its unrelated changes are explicitly excluded.

## Experience

- Desktop admin navigation opens at 240 px and can collapse to a 72 px icon rail. Each route has a
  recognisable icon, text label when expanded, tooltip/title when collapsed, and a clear active
  state. The preference persists locally.
- Only sidebar width and label visibility animate, for 160-180 ms. Reduced-motion users receive an
  immediate state change. The existing mobile drawer remains the mobile navigation.
- Staff sign-in and account-claim password fields use one reusable control. Its 44 px button toggles
  between masked and visible text, exposes an accurate accessible label, preserves focus, and does
  not submit the form.
- The existing corner-bracket treatment remains unchanged in shape and increases from 2 px to 3 px.

## Email system

A pure backend template module owns the email-safe HTML shell and plain-text structure. It uses
table-based layout, inline styles, a restrained brand-colour header accent, a readable title and
preheader, a primary content panel, optional detail or code blocks, and a quiet footer. Branding is
derived from configured sender metadata; no new business contact, policy, delivery, or payment fact
is invented.

Verification, password-reset, order-created, payment-confirmed, and order-status messages all use
the shell. Dynamic values are escaped exactly once, existing security and expiry wording is
preserved, and the text alternative contains the same material information. No external image is
required for the message to remain recognisable or usable.

## Boundaries

- No authentication, authorisation, order-state, database, delivery, or payment behaviour changes.
- No mobile-admin navigation redesign.
- No deployment or production environment mutation beyond pushing the isolated commit to `main`.
- No files from the dirty primary worktree enter the release.

## Verification

Regression tests must first fail for the missing sidebar contract, password toggle, and shared email
shell. The decorative bracket weight is verified in the built stylesheet and release diff rather
than by a brittle source-text assertion. The release then requires focused tests, formatting, lint,
TypeScript, business-fact checks, the full repository verification command, a diff review against
`origin/main`, and confirmation that the pushed commit is the only new remote-main change.
