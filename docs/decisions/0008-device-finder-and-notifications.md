<title>ADR 0008 — The device finder, and the emails that were never sent</title>

# ADR 0008 — Finding a case that fits, and telling people what happened

**Date:** 2026-09-02 · **Status:** Accepted · **Scope items:** "Device compatibility", "Contact", "Reviews", Q6 payment notification · **Builds on:** [`0005-order-lifecycle-and-reviews.md`](0005-order-lifecycle-and-reviews.md), [`0006-storefront-composition-and-likes.md`](0006-storefront-composition-and-likes.md)

## Context

Two audits, one change, because both found the same shape of gap: something the
system already knew, that it never told anybody.

**Compatibility was modelled and unreachable.** The `device` table, the
`product_compatibility` join, both indexes, the admin screens and the catalogue
filter had all existed since migration 0003. The only way a shopper could reach
any of it was a rail of pills on `/shop` that scrolled sideways — so on a 360 px
screen every model past the right edge was invisible, with nothing to say they
were there, and each model staff added made it worse. Nothing anywhere let a
customer type the phone they own. The product page, where "will this fit?" is
actually asked, said nothing about fit at all. And search could not answer
"iPhone 13 case", because the full-text index covers a product's own name,
summary and description, and what a pouch fits is a fact about a different table.

**Five emails existed; eight triggers were silent.** Order placed, payment
confirmed, single status change, password-reset code and staff verification
code. Everything else changed state and told nobody. The worst of them:
`rejectProof` collected a reason from staff, stored it, returned the order to
awaiting-payment, and sent nothing — so a customer who believed they had paid
found out by reopening the tracking page, or by transferring a second time. The
bulk order action moved orders through the same state machine as the single one
and skipped the email, so whether a buyer heard about their order depended on
how a staff member clicked. And `RESEND_EMAIL_SEND_TO` was documented in
`.env.example` as "where operational alerts go" and read by nothing: there was
no staff-facing email in the system at all.

## Decisions

### 1. One matching rule, in the domain, used by both surfaces

[`domain/device-match.ts`](../../packages/pv-backend/src/domain/device-match.ts)
is pure and has two functions, because a typeahead and a sentence-scanner are
genuinely different questions and one "search devices" helper would answer one
of them badly:

| Function             | Answers                                     | Rule                                                                         |
| -------------------- | ------------------------------------------- | ---------------------------------------------------------------------------- |
| `filterDevices`      | "I am typing a model, narrow the list."     | every typed token prefixes some token of the brand-and-model label           |
| `findDeviceInPhrase` | "Is a model hiding in this shopping query?" | the model's own tokens appear **contiguously and in order** within the query |

Tokenising splits at letter/digit boundaries as well as punctuation, so
`iphone13` and `iPhone 13` compare equal — on a phone keyboard the space is the
character most often dropped.

`findDeviceInPhrase` is strict on purpose. Requiring whole tokens is what stops
a device called "A5" claiming a query about an A54, and requiring them adjacent
is what stops "13" and "pro" landing in a query for unrelated reasons and being
read as a model. A one-token model name only counts when the brand is named
alongside it — half the queries in a case shop contain "pro".

Being in `domain/` and importing nothing, the same rules run in the browser for
the finder and on the server for search. There is no second implementation to
drift.

### 2. A combobox, not a rail and not a `<select>`

A native `<select>` on Android opens a full-screen list with no way to type,
which is the one interaction that matters here. So it is a real ARIA 1.2
combobox: `role="combobox"` on the input, options as direct children of the
listbox, focus staying in the text box with `aria-activedescendant` naming the
current option.

The device list is one small row per model and is already loaded with the page,
so filtering happens in memory. No request per keystroke, and the suggestions
keep up on Nigerian mobile data.

**Free text never navigates.** Enter selects a device that is really in the list
or does nothing. Guessing would send someone to an empty shop and present it as
a result about their phone.

It renders nothing when no devices exist, so a shop that has not been set up
does not show a promise it cannot keep. It appears in the home hero, above the
shop grid, and the empty grid now names the device rather than saying "those
filters" — a catalogue covers far fewer models than exist, so "nothing fits your
phone yet" is the likeliest outcome and the one worth saying plainly.

### 3. Search recognises a model; the search index is left alone

A query naming a device offers the filtered shop alongside the ordinary results.

The alternative was denormalising device names into `product.search_vector`.
Rejected: the compatibility join already holds that fact, a second copy has to be
kept in step on every compatibility edit, and it needs a schema change to a
`STORED` generated column that could not be verified in this environment. The
recognition path needs no migration and delivers the same outcome — the shopper
lands on a list filtered by what actually fits rather than by what a product's
name happens to say.

### 4. The product page says what it fits

An empty compatibility list renders nothing rather than claiming the product fits
everything. Empty means one of two things — a universal pouch, or staff who have
not filled it in — and neither is the page's to guess (§0 rule 2).

### 5. Email is grouped by what it is about, and fired by the adapter

`order-email.ts` was accumulating messages that had nothing to do with orders.
It now holds order and payment mail only; account mail (welcome, reset code,
password changed) moved to `account-email.ts`, and enquiries and reviews got
their own modules. The password-reset code moved with them — it never had
anything to do with an order.

Every send still fires from the route or action, after the transaction commits
and after authority is checked, never from inside a service. That was already
the pattern; what changed is that the `void send.catch(log)` around it stopped
being copied by hand at each call site. [`server/notify.ts`](../../apps/pv-frontend/src/server/notify.ts)
holds it once, and logs the error **name** only — §5 forbids a recipient, a
token or a proof URL reaching a log, and a driver or fetch error frequently
carries all three in its message.

### 6. What each new message may and may not carry

- **Proof rejected** delivers the staff reason, which is the entire point of
  collecting it, and says the order is still open so nobody pays twice. It does
  not repeat the bank details: the order confirmation already carried them, and
  a rejected proof is no reason to put an account number in a second mailbox.
- **Proof received** says the file arrived and that a person will check it.
  Nothing more, because nothing more is true yet.
- **Password changed** is the one message that must reach the account's owner
  when the person who changed the password was someone else. It therefore
  carries no code, no password and no link back in — an attacker holding the
  mailbox must gain nothing from receiving it. It is sent on both routes to a
  new password.
- **Welcome** is not a verification step. ADR 0002 removed the inbox round-trip
  and this does not reinstate it; the account already works. It gives a mistyped
  address somewhere to fail visibly.
- **Review rejected** tells the author it was not published and deliberately not
  why. The reason field is staff wording written for staff — "spam", "abusive" —
  and the service does not even load the column, which is the strongest form of
  that guarantee.
- **Staff alerts** (enquiry waiting, proof waiting) go to `RESEND_EMAIL_SEND_TO`
  and carry no proof URL. When it is unset they are skipped silently: a shop that
  has not configured an inbox should lose an alert, never fail the customer
  action that triggered it.

### 7. Bulk actions notify exactly what moved

`transitionOrders` and `moderateReviews` now return the ids that actually
changed, not just a count. Neither batch is atomic — the state machine and the
still-pending check refuse some rows — so "notify all of them" would email
people about a move that never happened, or about a decision a colleague made
days ago.

## Consequences

- `transitionOrders` returns `movedIds`, and `moderateReviews` returns `string[]`
  where it returned `number`. Both are internal; the only callers are the admin
  actions changed alongside them.
- `listDevices` returns `brandName` rather than `brand_name`, matching the domain
  type so the matcher applies to it unchanged. `DeviceFilter` is deleted.
- `loginCustomerWithGoogle`'s `created` flag (ADR 0007) is unrelated to this but
  shares the pattern: a service reports what happened, and the adapter decides
  what to send.
- A shop with no `RESEND_EMAIL_SEND_TO` gets no staff alerts and no error. Worth
  naming in the launch runbook.

## What was left undone, and why

**Staff lifecycle email.** A minted role code is still shown once on screen and
carried out of band, and a suspension still ends sessions without a message.
Emailing a role code would weaken it: the whole point of `BOOTSTRAP_CEO_EMAIL`
pinning who may redeem one is that a code seen in a mailbox or a log is not by
itself enough. A suspension notice is defensible and is a product decision about
how the client wants to part with staff, not an engineering gap — it belongs in
[`open-questions.md`](../open-questions.md), not in a quiet default.

> **Resolved 2026-09-02.** [Q11](../open-questions.md) came back answered: yes,
> and the CEO writes it at the moment they change the access. The Suspend and
> Reactivate controls on `/admin/staff` now open a composer, and
> [`staff-email.ts`](../../packages/pv-backend/src/services/staff-email.ts) sends
> those words through the same template as everything else.
>
> The message stays optional — access must never remain open because nobody
> could find the right words — and it carries **no sign-in link and no code**.
> This is the one message the system sends deliberately to somebody it has just
> stopped trusting, at an address that may no longer be theirs, so anything more
> than an explanation would be a way back in that outlives the mailbox. What was
> written is stored on the audit record as well as sent.
>
> The role-code half stands as recommended: still shown once, still never
> emailed.

**A pending-review or pending-proof digest.** Both queues now alert on arrival.
A daily "you have twelve waiting" is a scheduled job, not an email, and is Phase
4 work once real volume says whether it is needed.
