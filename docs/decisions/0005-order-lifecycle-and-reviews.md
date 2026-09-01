<title>ADR 0005 — Order lifecycle, and who may review</title>

# ADR 0005 — The shape of an order, and open reviews

**Date:** 2026-08-31 · **Status:** Accepted · **Client decisions:** [`../open-questions.md`](../open-questions.md) Q6, Q8, Q9 · **Builds on:** [`0002-access-and-verification.md`](0002-access-and-verification.md)

## Context

Q6 and Q9 came back answered, in the client's own words, and both answers are
more specific than the plan they were written against. Q6 in particular describes
a complete flow that had been carried as _"the Q6 state machine"_ — a placeholder
for something nobody had written down. This record writes it down, because a
state machine that lives only in a paragraph gets implemented differently by the
next person who reads the paragraph.

Q9's answer also contradicts two other documents, and that had to be resolved
rather than averaged.

## Decisions

### 1. The order lifecycle, from Q6

The client's description, in order: _"User places order, chooses home delivery
(delivery fee set by admin and shown when users chooses home delivery, location:
lga, landmarks) or pick up, pays into the account number, uploads the payment
prove, registerd phone, location and delivery intent, and admin sees it in the
thier payment confirmation page, accepts it and user gets Email notification that
payment is reciewd"_.

That is eight states and one branch:

```
                    ┌─────────────────┐
                    │ awaiting_payment│◄─────────┐
                    └────────┬────────┘          │ proof rejected
                             │ customer uploads  │
                             ▼                   │
                    ┌─────────────────┐          │
                    │ proof_submitted ├──────────┘
                    └────────┬────────┘
                             │ staff accepts  → email: payment received
                             ▼
                    ┌─────────────────┐
                    │payment_confirmed│
                    └────────┬────────┘
                             │ staff begins fulfilment
                             ▼
                    ┌─────────────────┐
                    │    preparing    │
                    └───┬─────────┬───┘
              pickup    │         │   delivery
                        ▼         ▼
          ┌─────────────────┐  ┌────────────┐
          │ready_for_pickup │  │ dispatched │
          └────────┬────────┘  └─────┬──────┘
                   └────────┬────────┘
                            ▼
                     ┌────────────┐
                     │ completed  │   terminal
                     └────────────┘

  cancelled is reachable from every non-terminal state. terminal.
```

The branch after `preparing` is decided by the order's `fulfilment` field, not by
staff choice: a pickup order cannot be dispatched and a delivery order cannot be
marked ready for pickup. The transition table enforces it.

`awaiting_payment → proof_submitted` is the only transition a customer performs.
Every other one requires a staff member holding the matching permission, and each
writes both an `order_event` row (the customer-visible timeline) and an
`audit_event` row (the privileged-mutation record §5 requires). Those are
different readers, so they are different tables.

**Payment proof is optional**, per scope item 09 — _"Payment Proof — Optional
upload"_. An order can reach `payment_confirmed` from `awaiting_payment` directly
when a staff member confirms the transfer landed without a proof having been
uploaded. The common path goes through `proof_submitted`; the direct one exists
because the bank statement is the real evidence and the proof is a convenience.

### 2. Delivery, from Q6 and Q8

`fulfilment` is `delivery` or `pickup`. A delivery order carries an LGA, an
address and a landmark — Q6 names all three, and a landmark is how an address is
actually given in Lagos.

The fee comes from the admin-managed `delivery_zone` table and **is snapshotted
onto the order** at placement, like every other price. An order placed before a
fee rise is not retro-priced. Where no zone matches, the fee is zero and the
order records that no zone was resolved, rather than guessing.

### 3. Anyone may review — Q9, resolving a three-way contradiction

Three documents disagreed:

| Source                                  | Said                                         |
| --------------------------------------- | -------------------------------------------- |
| Q9, the client's answer                 | _"Anyone can review."_                       |
| Q9's "meanwhile" paragraph, ours        | _"reviews require an authenticated account"_ |
| [`../work-plan.md`](../work-plan.md) §4 | _"anyone may review, held for approval"_     |

**The client's answer wins**, and the meanwhile-text is corrected rather than
left standing. A review needs a name, a rating and a body — no account, no
sign-in wall. Q2's answer points the same way: _"If a review can be completed in
the home page with the via a clean modal … lets not force users to go the review
page before the can air thier view."_

Spam control is the moderation the client already asked for, plus rate limiting:

- **Every review is held for approval before publication.** Nothing a stranger
  types reaches the storefront without a staff member approving it.
- Rate limited per IP and per product. An unapproved review is invisible to
  everyone but staff, so the cost of a spam submission is one moderation click.
- Where the submitter's email or phone matches a `completed` order containing the
  product, the review is flagged as a verified purchase for the moderator's
  benefit. It is not shown as a badge on the storefront in V1 and it is never a
  precondition for publishing.

This does **not** weaken [`0002`](0002-access-and-verification.md). A review is
not an identity claim and grants nothing; order tracking is still authorised by
the order reference plus the registered phone, and nothing about reviewing
touches a session.

### 4. Guest orders, and the account that an order creates

[`0002`](0002-access-and-verification.md) already decided that an order creates
the account, via a ticked-by-default checkbox that is a real choice. That holds.
The consequence for the schema is that `customer_order.customer_id` is
**nullable**: an order placed with the box unticked belongs to no account and is
reachable only by reference plus phone. Contact name, email and phone are stored
on the order itself rather than only on the customer, which is also what keeps a
receipt correct after someone edits their profile.

## Consequences

- The transition table is a single typed constant with a test asserting every
  legal transition and, for each state, that the illegal ones are refused. Adding
  a state means editing one place.
- Because a customer may cancel only from `awaiting_payment`, an order that has a
  proof under review cannot be pulled out from under the staff member reviewing
  it.
- The verified-purchase flag is computed at submission and stored. Recomputing it
  later would let an order placed afterwards retroactively change a published
  review's meaning.
- Reviews being open means the moderation queue is a real workload with real
  spam in it. That is a staffing fact the client should hear before launch, and
  it is on the Phase 5 training list.
