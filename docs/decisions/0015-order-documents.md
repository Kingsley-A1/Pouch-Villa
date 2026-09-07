<title>ADR 0015 — Invoices and payment receipts as PDFs, and why the QR code is only a link</title>

# ADR 0015 — Order documents

**Date:** 2026-09-07 · **Status:** Accepted · **Builds on:** [`AGENTS.md`](../../AGENTS.md) §4, §5, §6, §8

## Context

The client asked for a branded PDF receipt a customer can download after
uploading their transfer screenshot, a green confirmation screen while the
payment is being reviewed, the same documents in the admin, a QR code carrying
the order reference so that scanning it shows what was ordered, and the receipt
attached to the order confirmation email. They supplied a reference layout —
their name top-left, `INVOICE` top-right, the mark beneath it, Bill To against a
column of metadata, a `DESCRIPTION` / `AMOUNT` table, a total in naira, terms at
the foot — and asked for the credit line to read **Powered by Bespoke Invoice**.

Nothing in the codebase generated a document of any kind. Every prior "receipt"
in this system is the customer's own upload: a photograph or bank PDF, stored
privately, read only by an authorised staff member.

## Decision

### Two documents, not one

An **invoice** exists from the moment the order does and states what is owed. A
**payment receipt** states what has been received against it, and cannot
truthfully exist before somebody has paid. One document covering both would mean
handing a customer a page headed RECEIPT before they had transferred anything.

The receipt states where the payment has actually got to — `Under review`,
`Confirmed`, `Awaiting payment`, `Order cancelled` — and labels its total to
match: `TOTAL PAID` only once the order has moved past payment, `TOTAL DUE`
otherwise. This is what makes it safe to hand over the moment a screenshot lands,
which is when the client wants it handed over.

### Neither document carries bank details

The order-placed email already sets out the transfer details, in the message the
customer is looking at when they pay. A PDF forwards more easily than an email
body, and §5's rule against repeating bank details into a second context is the
same reason `sendProofRejectedEmail` does not repeat them. An invoice is a
statement of what is owed, not a second copy of where to send it.

### The QR code is a link, not an entitlement

It resolves to `/orders/{reference}` on this deployment. Authority is re-derived
there exactly as it is for anyone typing the URL: the owner's session, the
short-lived placement grant, or `/track` with the registered phone (ADR 0002). A
receipt can be photographed off a desk or forwarded with an email, so a code that
granted access by itself would be a bearer token printed on paper — and the
reference it carries is already visible on the same page in plain text.

A signed-in owner therefore lands straight on their order; anyone else reaches
`/track` with the reference filled in. That is the client's ask — _scan it and
see exactly what was ordered_ — without weakening the rule that protects it.

### One route serves both readers

`GET /api/v1/orders/{orderId}/receipt?kind=invoice|receipt` answers the customer
and the staff member from the same code, the way the proof-document route already
folds `?download=1` into one path rather than two. Three ways in, and the URL is
none of them: a staff session carrying `order.view`, the customer whose account
owns the order, or the placement grant. Everything else gets a 404 — the same
status an unknown order id gets, so the route cannot be used to discover which
ids are real.

Unlike `readProofDocument`, this read is **not** audited. A proof is a bank
document that §5 names specifically; an invoice carries no bank details and shows
a staff reader nothing the admin order page already shows them without an audit
record. An audit trail that records every glance is one nobody reads when it
matters.

### `pdf-lib` and `qrcode`, server-side only

Both live in `@pv/backend` and neither reaches the browser, so §2's 120KB budget
is untouched. `qrcode` is used only for its module matrix — the renderer draws
each dark module as a filled rectangle, so the code is vector, exact at any zoom,
and costs a few kilobytes of drawing operations rather than an embedded image.
Reed–Solomon correction and mask selection are a specification, not a puzzle
worth re-solving; a subtly wrong implementation scans on the phone you tested
with and fails on the customer's.

### Two things a standard PDF font cannot do

**The naira sign.** ₦ is U+20A6 and WinAnsi — the only encoding the standard
fonts have — does not contain it. Embedding a Unicode font would carry several
hundred kilobytes on every invoice for one glyph, and printing `NGN` is correct
but is not what the client drew. It is an N with two bars, so `drawNaira` draws
an N with two bars, proportioned as fractions of the font size. A line reading
_All amounts in Nigerian Naira (NGN)_ sits under the total, so the document stays
unambiguous even where that artwork does not survive a viewer or a photocopier.

**Everything else outside Latin.** pdf-lib _throws_ on an unencodable character,
which would turn one oddly-typed product name into a customer who cannot download
their receipt at all. `toWinAnsi` folds text into the encoding first: the
typographic characters that reach a description are mapped, ₦ becomes `NGN`
rather than vanishing from an amount, and anything genuinely outside Latin is
dropped rather than replaced — a row of question marks reads as a broken
document, a missing character reads as a name.

### The logo is baked into source

`scripts/generate-pdf-logo.mjs` crops the client's supplied artwork and writes
`src/documents/logo-asset.ts`. Reading it through `fs` instead would work locally
and produce a logo-less invoice in production the first time the bundler's file
tracer missed the path — a failure that shows up in a customer's inbox rather
than in CI. Fetching it over HTTP from ourselves mid-request buys a network round
trip and a new failure mode for a file we already ship.

### Terms come from the admin

"Payment is due exactly when the order is placed" is policy wording, which §4
puts in the settings store rather than in source — the day it stops being true it
has to change without a deployment. `store.invoice_terms` is a new key with a
field under **Invoices and receipts** in Store details. Unset, the block is left
off the document entirely rather than filled with a default nobody agreed to
(§0 rule 2).

## Consequences

- **The terms block is empty until the CEO types it.** That is the intended
  behaviour, and it is the one thing standing between the shipped document and
  the client's reference layout.
- **Order confirmation now builds a PDF.** It runs after the transaction commits,
  off the request path, and degrades to an email without an attachment rather
  than to no email — the "your invoice is attached" line is only printed when a
  file actually is.
- **A green surface exists in a red shop.** `--pv-success-panel` and its pair are
  stated on all four grounds precisely so the payment confirmation is
  recognisably green wherever it renders. It is the only one, deliberately.
- **`pdfText` in `tests/helpers` is not a PDF parser.** It inflates content
  streams and reads hex string operands, so it can prove a word was drawn but not
  where. That is the right amount of machinery for these assertions and far less
  than a real parser would cost to keep working.
