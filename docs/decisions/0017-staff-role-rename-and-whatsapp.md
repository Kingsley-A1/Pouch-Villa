<title>ADR 0017 — The third role is Staff, and the number we hold is a WhatsApp number</title>

# ADR 0017 — Staff, not Employee. WhatsApp, not phone.

**Date:** 2026-09-08 · **Status:** Accepted · **Supersedes the naming in:** [ADR 0002](0002-access-and-verification.md), [ADR 0016](0016-paying-in-store.md) · **Builds on:** [`AGENTS.md`](../../AGENTS.md) §5, §7

## Context

Two vocabulary corrections from the client, both about words a person reads
rather than behaviour.

The third access level was called **Employee**. The client's own words for their
three levels are CEO, Manager and Staff.

Every field holding a customer's number was labelled **Phone**. The shop reaches
customers on WhatsApp — it is how orders are chased, how delivery is arranged and
how a customer replies. Asking for a "phone number" and then messaging it on
WhatsApp works only because the two are usually the same number, and quietly
fails for the customer whose WhatsApp is on a different line.

## Decision

### Rename the role code, not just the label

`staff_role` has a `label` column precisely so the displayed name can differ from
the code, and changing only that would have been one `UPDATE` with no risk.

It would also have left `EMPLOYEE` underneath a screen saying "Staff" forever.
§7 says names say what a thing is, and a permanent translation between what the
CEO reads and what an engineer reads is exactly the drift that costs three years
from now. So migration `0016_staff_role_rename.sql` renames the code.

`staff_role.code` is a primary key referenced by `role_permission`, `staff` and
`staff_role_code`, so it cannot be updated in place under live children. The
migration creates the new role, **copies the grants as they currently stand**,
repoints every child, then deletes the old role. Copying rather than re-seeding
from `0002`'s defaults matters: whatever the CEO had granted at runtime is what
the renamed role keeps, and re-seeding would have silently revoked their edits.

Nothing signs anybody out. A staff member's role is read from their row on each
request rather than carried in their cookie, so an account moves the moment its
`role_code` does. An unredeemed code minted for the old level still works and now
creates an account on the new one.

### Replay safety, extended by proof rather than by exemption

The migration needs two `UPDATE`s and a `DELETE`, and `migrations.test.ts` had no
safe shape for either — a file is not atomic, so every statement must survive
being run twice.

Rather than add them to an exemption list, the rule now admits two shapes that
are idempotent **by construction**:

- `UPDATE t SET c = 'new' WHERE c = 'old'`, where a backreference forces the SET
  column and the WHERE column to be the same one. After the first run nothing
  matches the WHERE.
- `DELETE FROM t WHERE c = 'literal'`. The second run finds nothing.

Both are deliberately narrow — an update against a different column, or with a
computed value, still fails the check and has to be argued for on its own terms.
That is a stronger guarantee than "somebody looked at it", which is what an
exemption list gives you.

### "WhatsApp number" is a relabel, not a new field

One number per customer, as before. `phoneSchema`, `normalisePhone` and the
`contact_phone` column are unchanged, and no data moves.

The rename is applied to **every** place a customer or staff member reads it —
checkout, order tracking, the tracking page's explanation, the order page, the
contact form, account details and sign-up, the admin's order and payment screens,
the staff profile, the confirmation and enquiry emails, the receipt QR caption,
and the two validation messages. Renaming the checkout field while the tracking
page still asked for "the phone number on the order" would read as two different
numbers and send people looking for one they never gave.

The identifiers stay `phone`. Renaming the column and every parameter behind a
label change would be a large diff with a migration in it for no behavioural gain
— and the field genuinely holds a phone number, which is what makes it reachable
on WhatsApp in the first place.

## Consequences

**Run `pnpm run db:migrate`.** Until it is applied the code expects a `STAFF`
role the database does not have, and staff sign-in for that level will fail.

**Nothing in the storefront or the API contract changes.** The checkout field is
still `contactPhone`, so an existing client keeps working.

**`docs/scope.md` still says "Employees".** It is the client's signed scope,
transcribed verbatim, and AGENTS.md forbids editing it to match what we built.
This ADR is the record of the divergence.
