<title>Staff access — how the codes work</title>

# Staff access — how the codes work

Operational reference for the CEO and whoever administers the admin. The
decision record behind this is [`decisions/0002-access-and-verification.md`](decisions/0002-access-and-verification.md);
this document is the how-to.

## The rule underneath everything

**A staff account exists only where a role code was redeemed.** Nothing is
seeded — no CEO email, no manager email, no default password — and no
credential comes from an environment variable except the one-time bootstrap
below. Signing in with Google proves control of a mailbox and confers nothing
else: it cannot create a staff account, cannot pick a role, and cannot raise
one.

Three access levels, and no more: **CEO, Manager, Employee**. A code carries
exactly one of them. Anything finer than that — can this manager confirm
payments, can that employee moderate reviews — is a permission on the role,
edited by the CEO at runtime in `/admin/roles`. It is never a fourth tier and
never a per-account override.

## The code itself

- 8 characters, from a 32-symbol alphabet with `O`, `0`, `I`, `1`, `L` removed
  — these get read off a screen and typed on a phone, so the ambiguous ones
  are gone before they can cause a mistyped redemption.
- Displayed grouped for reading aloud, e.g. `PVCE-4827-1930`.
- Only the SHA-256 hash is ever stored. The plaintext exists exactly once —
  in the output of the command or form that minted it. Reading the database
  does not hand anyone a usable code. **Lost means mint another**, there is
  no recovery.
- Each code has a role, a use count (default 1), an expiry, and an optional
  label recording who it's for.
- Redemption is one database transaction: a code cannot be consumed without
  an account being created, and an account cannot be created from a code
  that was already spent — even if two people submit the same single-use
  code at the same instant.
- Every rejection — wrong, expired, exhausted, revoked — shows the same
  generic message. Distinguishing them would tell someone probing the form
  which codes are real; the real reason goes to the audit log instead.

## Getting the first CEO in

Nobody exists yet to mint a code for the first CEO, so that one comes from
the server, not the admin UI:

```
pnpm run claim-code --role CEO
```

This is deliberately different from every other code:

- **15-minute expiry**, not 7 days — it's meant to be used immediately.
- **Pinned to `BOOTSTRAP_CEO_EMAIL`** (set in the environment). Only that
  exact address can redeem it, so a code glimpsed in a terminal scrollback
  or a log isn't enough on its own — the attacker would also need control of
  that specific mailbox.
- Single use. Once redeemed, the command must be run again to produce
  another — there's no way to view a previously minted code.

Take the printed code to `/admin/claim`, enter it with that pinned email, a
full name, and either a password (12+ characters) or Google sign-in. That
creates the CEO account and signs you in.

If it expires before you get there, just run the command again — minting
doesn't cost anything and the old code simply lapses.

## Bringing on a manager or employee

Once a CEO exists, every further hire is code-based through the UI — the CLI
command is never used again:

1. CEO opens `/admin/staff` → **Issue a role code**.
2. Picks the level (Manager or Employee), labels it with who it's for,
   sets how many times it can be used (usually 1) and how long it's valid.
3. The plaintext code appears once, on screen. Read it aloud, message it,
   write it down — however you like, it's designed to survive being spoken.
4. The new hire opens `/admin/claim`, enters the code with their own email,
   name, and a password or Google sign-in.
5. They land on `/admin/verify-email` (password sign-up) or straight into
   `/admin` (Google, since the mailbox is already proven).

The role on the resulting account is **whatever the code carried** — the
person redeeming it never chooses. There is no role field on the claim form.

Minting a code requires the `staff.manage` permission, which is **CEO-only
and cannot be granted away**: it's one of exactly two permissions
(`role.manage` and `staff.manage`) excluded from every other role by default,
and the CEO role itself cannot be edited, demoted, or have its last holder
suspended. A manager cannot mint codes, and cannot edit the permission table
to give themselves the ability to.

## Verification

- **Password sign-up** is unverified until a 6-digit code, sent to the email
  given, is entered at `/admin/verify-email`. This is a numeric code typed
  into a page already open, not a link — links leak through forwarded mail
  and shared inboxes, and break inside in-app browsers.
- **Google sign-up** skips this. Google has already proven the mailbox.

## Managing staff after they're in

`/admin/staff` also lists every staff account with a **Suspend** action.
Suspending:

- Blocks sign-in immediately.
- **Revokes every existing session for that account right away** — this
  does not wait for a session to expire on its own. Firing someone ends
  their access the moment you click it, not whenever their token happens
  to lapse.

Unused or wrong codes can be **revoked** the same way, before anyone
redeems them.

## Default permissions by role

Set in [`migrations/0002_permission_catalogue.sql`](../packages/pv-backend/migrations/0002_permission_catalogue.sql)
as the starting grants — all editable by the CEO at runtime except the two
marked CEO-only.

| Role     | Starts with                                                                                                                                                                              |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CEO      | Every permission, always — re-asserted on every migration run so a newly added permission is never accidentally withheld.                                                                |
| Manager  | Every permission except `role.manage` and `staff.manage`.                                                                                                                                |
| Employee | `dashboard.view`, `product.view`, `order.view`, `order.manage`, `payment.view`, `customer.view`, `enquiry.manage` — day-to-day fulfilment. No money settings, no staff, no role editing. |

Changing what a Manager or Employee can do is a CEO edit in `/admin/roles`,
not a code change or a redeploy.

## What this deliberately does not do

- There is no "resend my code" for a lost role code — mint a new one and
  revoke the old.
- There is no way to change an account's role after redemption from the UI
  described here; that would need a direct decision from the CEO and isn't
  built as a self-service action, on purpose — role changes are rare and
  worth being deliberate about.
- Staff and customers share no session, cookie, table, or code path. A
  Google identity that resolves to a customer can never resolve to a staff
  member — the two lookups are against different tables entirely.
