<title>0014 — Staff visibility on the storefront</title>

# 0014 — A staff member is recognised on the storefront, not signed into it

**Status:** accepted, with one half deferred to the client — [`../open-questions.md`](../open-questions.md) Q12
**Date:** 2026-09-04
**Raised by:** client review — _"When an admin is signed in in the admin portal, it should still be signed in on the public side."_

---

## The complaint

The CEO signs into `/admin`, taps **View store**, and the storefront greets them
with a **Sign in** prompt. To them the site has logged them out between two
pages of the same product. It reads as a bug, and as a report of what they saw
it is a fair one.

## Why it happens

It is [`AGENTS.md`](../../AGENTS.md) §5 working as specified. Customers and staff
share no session, no cookie, no table and no code path, so that a privilege bug
in the storefront cannot reach the admin. The storefront genuinely does not know
who is looking at it; there is no customer session, because no customer signed
in.

## What we will not do

**Make one sign-in produce both sessions, or teach the storefront to read the
staff session as an identity.** Either would put the admin's identity inside the
storefront's blast radius, which is the single thing §5 exists to prevent, and
§0 rule 4 makes it a blocking review failure rather than a trade-off we are free
to price.

It would also be wrong on its own terms. A staff session is not a customer:
there is no cart to own, no order history to show, no delivery address, and no
customer row to attach a review to. "Signed in" on the storefront would be a
claim the site could not honour, and the first tap on **Your account** would be
a worse surprise than the one it replaced.

## What we did

The storefront **recognises** the staff session without adopting it. A thin bar
above the header reads _"Signed in to the admin as ⟨name⟩"_ with a link back to
the admin, and it appears for nobody else.

The safety argument is in the shape of the seam, not in a promise to be careful.
`server/staff-viewer.ts` exposes exactly one function returning a **display name
string or null** — never a `StaffPrincipal`. There is no staff id to look a
permission up with, no role to branch on, and no session object for a later edit
to start trusting. The worst that storefront code can do with the value is print
it. Narrowing at the seam rather than at the call site is what makes that true
for every future caller, not just today's.

Costs a shopper nothing: with no staff cookie on the request the function
returns at the cookie read, before any query.

## What is still the client's to decide

The stronger reading — that signing into the admin should also sign you into the
shop as yourself, so a manager can place a real order without a second sign-in —
is a change to the security posture and is theirs to make with the trade-off
stated. It would mean a staff account being **linked to** a customer account they
own, and a staff sign-in minting that customer session alongside the staff one.

The boundary that matters would survive it: the storefront would still only ever
see a customer session, so a storefront bug still could not reach the admin. What
would change is that compromising a staff sign-in also yields their customer
account — strictly less privileged, but no longer nothing — and that redeeming a
role code would implicitly create a second identity, which §5 currently forbids.

Raised as Q12 rather than assumed either way.
