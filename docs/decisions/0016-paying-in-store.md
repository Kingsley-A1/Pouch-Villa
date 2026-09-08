<title>ADR 0016 — Paying in store: cash, POS and a transfer made at the counter</title>

# ADR 0016 — Paying in store

**Date:** 2026-09-08 · **Status:** Accepted · **Builds on:** [`AGENTS.md`](../../AGENTS.md) §3, §5, §6 · [ADR 0005](0005-order-lifecycle-and-reviews.md)

## Context

The client sells online and over a counter. They asked what happens to a customer
who chooses to collect and wants to pay cash or on the POS terminal when they
arrive, and whether the platform records which of those it was.

It did not. Every order landed in `awaiting_payment`, which the storefront renders
as **"Waiting for your transfer"**, and the order page offered exactly two things:
the shop's bank account and a box to upload a transfer receipt. For somebody
bringing cash, both are instructions for a task they will never perform. The order
itself was correct; the screen was telling them something untrue about it, and the
client's word for that was "broken".

Underneath, `payment.method` was a column constrained to a single value,
`bank_transfer`, so even a staff member who took cash had nowhere to say so.

## Decision

### Three facts, three columns

The mistake available here is to store one thing called "payment method". There
are three separate facts and merging any two loses something the shop needs.

| Fact                          | Column                                    | Written by            |
| ----------------------------- | ----------------------------------------- | --------------------- |
| When they pay                 | `customer_order.payment_timing`           | Customer, at checkout |
| What they said they would use | `customer_order.preferred_payment_method` | Customer, at checkout |
| What they actually paid with  | `payment.settled_method`                  | Staff, at the counter |

A preference is not a record. Somebody who selected cash and then produced a card
must be recorded as having produced a card, or the till does not balance — and
overwriting the preference with the settlement would erase the fact that the shop
was expecting cash, which is what a reconciliation is comparing against.

`preferred_pickup_at` holds when they said they were coming, as a `TIMESTAMPTZ`
resolved from a wall-clock time against Africa/Lagos. It orders the counter queue,
which a sentence in the notes box could not.

### No ninth order status

`awaiting_payment` already means "the money has not arrived". That is equally true
of a transfer nobody has sent and a customer who has not walked in yet, so the
_state_ is genuinely the same and only the _sentence_ differs. `describeStatus`
takes the timing and returns one of two strings.

A new status would have to be handled in every switch that already exists, in the
transition table, in the admin filters and in the email templates, to express a
distinction that is presentational. [ADR 0005](0005-order-lifecycle-and-reviews.md)
warns about exactly this and the warning is right.

### Timing and method are asked separately

Folding them into one list of options produces combinations that read as
contradictions — "pay now with cash" — and hides a real case: a customer standing
at the counter can open their banking app and transfer. That is still a bank
transfer. It lands in the same account, still wants the order reference as its
narration, and still deserves the account details and the proof-upload box.

So `needsTransferInstructions` keys off the **method**, not the timing. Only cash
and the POS lose the transfer panel.

### One function records money, and it is not the status change

`recordCounterPayment` settles the `payment` row and then advances the order.
Routing a counter payment through the generic status change would have moved the
order and left the payment row saying `expected`.

That was **already true** of the admin's direct-confirm button before any of this,
and it is the more valuable half of this change: an order could read
`payment_confirmed` while the financial record disagreed. Both paths now write
`settled_method`, so every confirmed payment says what it arrived as.

The function refuses rather than no-ops when a payment is already settled. Two
staff members pressing the button is a question about whether the shop was paid
twice; swallowing it silently answers that question wrongly.

### A new column, not a widened constraint

`payment.method`'s CHECK is unnamed and inline in `0006_commerce.sql`. Changing it
needs `DROP CONSTRAINT` plus `ADD CONSTRAINT`, and `migrations.test.ts` bans a new
`ADD CONSTRAINT` outright — neither engine accepts `ADD CONSTRAINT IF NOT EXISTS`,
so such a statement cannot survive a replay.

Separating expectation from settlement was the better shape regardless, so the
constraint we could not change pointed at the design we wanted.

Two rules the migration therefore cannot express live in `placeOrder` and in
`checkoutSchema`: paying on collection requires `fulfilment = 'pickup'`, and cash
or POS requires `payment_timing = 'on_collection'`. Tests hold them there.

## Consequences

**The counter is one screen.** A customer reads their reference off their phone or
hands over a receipt whose QR already opens the order; staff search it, and the
take-payment card is the first thing in the column — above "Next step", because for
these orders it _is_ the step. Three buttons, an optional reference, one press.

**Recording a payment needs `payment.confirm`**, the same permission that accepts a
transfer proof. Taking cash and accepting a receipt are the same authority. Note
that an **Employee does not hold it by default**: if the person on the counter is
an Employee, the CEO grants it in Admin → Roles, which §5 makes a runtime decision
rather than a code change. This is called out in the client guide.

**A pending proof is accepted, not rejected,** when an order is paid in cash. It was
never wrong; it is simply no longer what the shop is waiting on. Leaving it pending
would keep a paid order in the staff queue.

**Older API clients are unaffected.** All three fields default to the online
transfer that was the only option before, so a caller that predates them — the POS
the client already runs ([`open-questions.md`](../open-questions.md) Q3) — keeps
placing valid orders without sending them.

## What this does not do

Split payments, part-payment on collection, and refunds are all out of scope. The
`payment` table is already rows rather than columns on the order, so none of them
needs a migration to reach.
