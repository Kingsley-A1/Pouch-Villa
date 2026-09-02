<title>ADR 0006 — Storefront composition, likes, and the customer account</title>

# ADR 0006 — How the home page is arranged, and who may like a product

**Date:** 2026-09-02 · **Status:** Accepted · **Scope items:** "Like & share", "Register / sign in (Email or Google)" · **Builds on:** [`0002-access-and-verification.md`](0002-access-and-verification.md)

## Context

Three gaps were closed together because they are one gap seen from three sides:
the storefront had no way for the business to arrange itself, no way for a
shopper to express interest, and no way for a customer to see their own history.

The home page rendered a hero, an optional flat list of every category, one
hardcoded grid of the eight most recently published products, and the store
address. That is the only arrangement the business could ever have, and changing
it required a deployment — the same failure mode [`AGENTS.md`](../../AGENTS.md)
§4 forbids for business facts, applied to merchandising.

The customer half of identity existed at the service layer and behind
`app/api/v1/auth/customer/*` since Phase 3, but **no page reached it**. There was
no way to register, sign in, recover a password or see an order history from a
browser. The scope's _"Register / sign in (Email or Google)"_ was therefore built
and unreachable.

Likes were absent entirely, and the note left in `product-card.tsx` recorded why:
the prototype's saved-items list was `localStorage` only, and was removed rather
than carried forward.

## Decisions

### 1. Three kinds of home section, not one

A shop merchandises in three genuinely different ways, and collapsing them into
one either loses expressiveness or forces the CEO to hand-pick rows that a rule
already describes:

| Kind           | Fills itself from  | For                                                    |
| -------------- | ------------------ | ------------------------------------------------------ |
| **category**   | a category         | "everything in Pouches" — stays correct as stock grows |
| **brand**      | a brand            | "everything by OtterBox", across every category        |
| **collection** | a hand-picked list | the editorial window display no rule describes         |

The kind determines which reference is required, enforced by a `CHECK`
constraint as well as in code, so a section that could render nothing cannot be
stored. Rule-driven sections offer a "See all" into `/shop`; a collection does
not, because it is complete by definition and a link to the whole shop would
misdescribe itself.

**A section that resolves to no products is dropped, not rendered empty.** An
empty heading reads as a broken shop, and the reason it is empty — an
unpublished product, a deactivated category — is never something a shopper can
act on.

### 2. "Where it appears" lives on the product, not the section

Collection membership is edited from each product's own form, alongside its
categories. The two answer different questions and are stored separately:
categories decide **what a product is**, collections decide **where it is
shown**. A product can leave a collection without any edit to what it is.

### 3. The storefront screen is gated by `product.manage`, not a new permission

Arranging the home page is a merchandising decision about products, made by the
people who publish them. A new permission code would mean a migration to the
catalogue and a grant the CEO must remember to hand out before anyone can use
the screen — cost with no separation gained, since anyone who can unpublish a
product can already decide what the shop shows.

### 4. Signed-out visitors may like a product

A like is attributable to exactly one actor: a signed-in customer, or a
signed-out visitor holding an opaque `HttpOnly` cookie. Both are supported
deliberately.

Requiring an account would measure almost nothing on a shop whose visitors are
overwhelmingly signed out, and the signed-out like is what a shopper uses as a
shortlist while deciding. The scope asks for _"like & share"_, not _"like, once
you have registered"_.

Only the SHA-256 of the visitor token is stored, never the token — the same
treatment session and cart tokens already get. **Likes made before signing in
follow the person into their account**, collapsing to one row where both
identities liked the same product. Without that, liking three things and then
registering would silently empty the list, which is the complaint that made the
prototype's `localStorage` list worth replacing rather than porting.

Uniqueness is enforced by two partial unique indexes, and the toggle leans on
them rather than a read-then-write: under serializable isolation, "check whether
they liked it, then insert" is a race that a double-tapped button on a slow
connection will find.

**A zero count is hidden, not rendered as "0".** A new shop showing a row of
zeroes tells a shopper only that nobody has bought anything, which is both
discouraging and not information they can use. The same rule applies to the
admin list.

### 5. Likes are not soft-deleted

[`AGENTS.md`](../../AGENTS.md) §6 says nothing is hard-deleted, and an unlike is
the deliberate exception. That rule protects records the business must be able to
account for later; an unlike is the withdrawal of an opinion, and keeping a
tombstone of it would mean retaining a person's browsing interest after they
explicitly took it back.

### 6. The account area is the only gated part of the storefront

`/account` and its children require a customer; the guard is in the route
group's layout, so a page added later is protected by existing rather than by
someone remembering. Nothing else is gated — checkout works as a guest, tracking
is authorised by reference plus phone, and reviews are open to anyone.

Two consequences worth stating:

- **Email is not editable from the profile.** It is the account's identity, the
  address a reset code goes to, and half of how an order is looked up. Changing
  it is an account-takeover step, not a profile edit, and it needs a flow that
  proves control of the new address first. That flow is not built.
- **Changing a password ends every session, including the current one.** A
  password change is what someone does when they think an account is
  compromised; leaving the intruder's session alive would make the act
  pointless.

An account created through Google has no password, so the profile offers to
**set** one rather than change one — which is how someone who signed up with
Google gains a second way in.

### 7. A proxy makes the signed-out redirect an HTTP one, and nothing more

The layout guard alone produced a **200, not a 307**. `(store)/loading.tsx` puts
a Suspense boundary above the account layout, so Next had already flushed the
shell by the time the guard resolved and could only finish the redirect on the
client. Nothing leaked — the payload carried the redirect and no account data —
but a signed-out visitor got a page reading "Loading" that only moved on once
JavaScript ran, which on a mid-range Android phone on Nigerian mobile data is a
page that appears to hang.

`src/proxy.ts` (Next 16's renamed middleware) restores the real 307. It checks
only that a session cookie is **present** — a cookie lookup, no database call —
which is exactly the "optimistic check" Next's own documentation describes,
alongside its warning that a proxy "should not be used as a full session
management or authorization solution".

**It is not the authorisation.** An expired, revoked or forged cookie gets past
it and is rejected by the layout, which verifies against the session table. The
fourth non-negotiable — the server is the security boundary — is unmoved:
deleting `proxy.ts` would cost the 307 and change nothing about who can see an
account.

The cookie name is imported from `@pv/backend/auth/cookie-names`, a module with
no imports of its own, so the proxy does not drag the database driver into a
layer that runs before every request — and a rename cannot silently leave the
proxy watching for a cookie that no longer exists.

### 8. Hero copy is a setting with a default in source

The headline and sub-heading are `store.hero_headline` and
`store.hero_subtitle`, editable in Settings, with wording in source used until
the CEO writes their own.

This does not weaken §4. That rule protects facts that become a **lie** if
invented — a phone number, a price, a policy sentence. There is no truth about
the business for a headline to contradict, and the page must say something above
the fold on the day it launches. Every genuine business fact on the home page
still renders _awaiting confirmation_ when unset.

## Consequences

- One `listHomeSections()` call issues one query for the sections and one per
  section, run together. That is bounded by how many sections the CEO has
  configured, and it is deliberately not a hand-rolled `UNION` that would
  re-implement the catalogue's price, stock and image joins — the drift
  `listPublishedProductsByIds` exists to prevent.
- Like state for a whole grid costs at most two queries, supplied by the page.
  `ProductGrid` stays presentational and fetches nothing (§7); a page that does
  not pass likes ships no client JavaScript for them.
- `establishCustomerSession` now owns everything that happens on sign-in — cart
  merge, like merge, fresh session — so the three auth routes and the two forms
  cannot drift on what signing in means.

## A defect found on the way

`savePolicySettingsAction` never read `policy.returns`, though the schema
required it and the form submitted it. Zod rejected every submission for a
missing key, so **no policy page could be saved from the admin at all** — the
form answered "Check the form." with nothing visibly wrong on it.

The fix is structural rather than a fourth `formData.get`: each settings schema
now has an exported field list, the action builds its submission from that list,
and a test holds the two in step. Adding a field to a settings form can no longer
silently break saving it.
