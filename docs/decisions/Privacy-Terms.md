# Pouch Villa — Privacy Policy and Terms & Conditions

> **Status: DRAFT, PENDING LEGAL REVIEW.**
>
> Q10 asked for these to be drafted "with the best information available,
> searching what is the current standard today". This is that draft. It is
> written against the **Nigeria Data Protection Act 2023 (NDPA)** and describes
> what the platform genuinely does — every processor, cookie, data field and
> retention rule below was read out of this repository, not copied from a
> template.
>
> **It is not legal advice and has not been reviewed by a lawyer.** Two things
> in particular need a named owner at Pouch Villa before launch:
>
> 1. **A Data Protection Officer / contact point**, and registration with the
>    NDPC if Pouch Villa meets the threshold for a data controller of major
>    importance.
> 2. **Confirmation of the retention periods** below. The platform currently
>    soft-deletes rather than erasing, and never hard-deletes audit records —
>    that is a deliberate engineering choice which the business must be willing
>    to stand behind, or which must change.
>
> Both pages are admin-editable at `/admin/settings`, so correcting them is not
> a deployment.

---

## Privacy Policy

Pouch Villa sells phone pouches, cases and device accessories. This notice
explains what personal information we collect when you use our website, why we
hold it, who else can see it, and what you can ask us to do about it.

It is written to meet the Nigeria Data Protection Act 2023. Pouch Villa is the
data controller for the information described here.

### What we collect

**When you place an order** we collect your name, email address, phone number
and, for delivery orders, your address, nearest landmark and local government
area. We record what you ordered, what you paid, and any note you leave us.

**When you upload a transfer receipt** we store the file you send. These are
financial documents and are treated as the most sensitive information we hold —
see _Payment receipts_ below.

**If you create an account** we store your email address, name, phone number and
a cryptographic hash of your password. We never store the password itself. If
you sign in with Google we store the identifier Google gives us, not your Google
password.

**When you leave a review or send us a message** we collect the name you give,
your rating and comments or enquiry, and any email address or phone number you
provide so we can reply.

**Automatically**, we record the IP address of requests that create something —
an order, a review, an enquiry, a sign-in attempt — and keep it briefly to stop
abuse and spam. We also keep an internal record of actions our own staff take on
your order, so we can answer questions about who changed what.

We do not collect card details. We are not a payment processor and no card
number ever reaches this website.

### Why we hold it, and on what basis

- **To fulfil your order** — this is necessary to perform our contract with you.
  Without your phone number and address we cannot deliver.
- **To confirm your payment** — we compare the receipt you upload against our
  bank records.
- **To keep your account**, where you asked for one. At checkout, the "Create my
  Pouch Villa account" box is ticked by default and you can untick it; we record
  the moment you consented so the choice is auditable.
- **To answer your enquiries and publish reviews you submit.**
- **To protect the shop** — rate limiting, fraud prevention and our audit trail
  rest on our legitimate interest in running the business safely.

### Payment receipts

Transfer receipts usually show bank account details, so they are handled
differently from everything else on the site:

- They are stored in a **private** location that is not reachable from the
  public internet.
- Staff can only view one through a **short-lived link** that expires within
  minutes.
- **Every single time a staff member opens a receipt, that access is recorded**
  against their name.

They are never published, never attached to a product page, and never included
in any email.

### Cookies

We use five cookies. None of them are for advertising, and we do not use
third-party analytics or tracking pixels.

| Cookie                | Purpose                                                   |
| --------------------- | --------------------------------------------------------- |
| `pv_customer_session` | Keeps you signed in                                       |
| `pv_cart`             | Remembers your basket before you sign in                  |
| `pv_order_grant`      | Lets you see the order you have just placed, for one hour |
| `pv_theme`            | Remembers whether you chose light or dark appearance      |
| `pv_staff_session`    | Signs in Pouch Villa staff only                           |

### Who else can see your information

We use a small number of service providers, and they may only process your
information on our instructions:

- **CockroachDB** — hosts our database.
- **Cloudflare R2** — stores product images and payment receipts.
- **Resend** — sends order confirmations and password reset emails.
- **Google** — only if you choose to sign in with Google.
- **Vercel** — hosts the website itself.

We do not sell your personal information, and we do not share it for
advertising.

### Where your information is held

**Our database is hosted in Germany.** If you are in Nigeria, your information
is therefore transferred outside Nigeria to be stored and processed. We rely on
our providers' contractual data-protection commitments for that transfer. You
can ask us for more detail about those safeguards via our
[Contact page](/contact).

### How long we keep it

Orders, receipts and account records are kept while your account is active and
afterwards for as long as we need them for tax, accounting and dispute
purposes.

You should know two specific things about how our system works:

- When something is deleted here it is **marked as deleted and hidden**, rather
  than immediately erased, so that order history and financial records stay
  consistent.
- Our record of staff actions is **append-only** and is not edited or removed.

If you ask us to erase your information we will do so wherever we are not
required to keep it, and we will tell you plainly what we must retain and why.

### Your rights

Under the NDPA you may ask us to:

- give you a copy of the information we hold about you;
- correct anything that is wrong;
- delete information we no longer have a reason to keep;
- restrict or object to how we use it; or
- provide it in a portable form.

You can also withdraw consent where we relied on it. To exercise any of these,
contact us using the details on our Contact page. We will respond within the
period the NDPA requires.

If you are unhappy with our response you may complain to the **Nigeria Data
Protection Commission**.

### Keeping information safe

Passwords are hashed with Argon2id and checked against public breach lists when
you set them, so a password known to have leaked elsewhere is refused. Traffic
to this site is encrypted. Staff accounts are separate from customer accounts,
sign-ins are rate limited, and staff sessions can be revoked immediately.

No system is perfectly secure, but if a breach affects your rights we will
notify you and the Commission as the NDPA requires.

### Children

This website is not intended for children, and we do not knowingly collect
information from anyone under 15.

### Changes

We may update this notice. The version on this page is always the current one.

---

## Terms & Conditions

These terms apply when you buy from the Pouch Villa website. Please read them
before ordering. By placing an order you accept them.

### Ordering

You may order as a guest or with an account. You must be able to enter a
contract, and the details you give us — particularly your phone number — must be
accurate, because we use them to reach you and to let you track your order.

### Prices and availability

Prices are in Nigerian Naira and include no delivery charge until you choose
delivery at checkout. We show stock as accurately as we can, but an item can
sell out between your adding it to the basket and completing checkout.

**The price you pay is the price shown when you place your order.** If we later
change a product's price, your order is unaffected.

### How an order is made

Placing an order is an **offer to buy**. It is not accepted until we have
confirmed your payment. If we cannot accept your order — because an item is
unavailable, the payment does not arrive, or the details cannot be verified — we
will tell you and refund anything you have paid.

### Payment

Payment is by **bank transfer** to the account shown at checkout. Please use
your order reference as the transfer narration so we can match your payment.

You may upload a copy of your transfer receipt to speed confirmation. It is
optional, but without it confirmation depends on us identifying your payment on
our statement. We confirm payment against our bank records, not against the
receipt alone.

### Delivery and collection

You may choose delivery or collection. Delivery charges and timeframes depend on
the area you select and are shown before you pay. Timeframes are estimates, not
guarantees. Please give a landmark — it materially affects whether a delivery
succeeds.

Risk in the goods passes to you on delivery or collection.

### Returns and warranty

Returns and warranty are covered by our **Return & Warranty Policy**, which
forms part of these terms. In summary: faulty items must be reported within 7
days of purchase; there is no refund or replacement for a change of mind;
pouches carry a 3-day warranty for manufacturing defects only; and approved
warranty claims are resolved by replacement rather than cash refund.

Nothing in these terms removes any right you have under Nigerian consumer law
that cannot be excluded.

### Reviews

Anyone may leave a review. Reviews are checked before they appear, and we may
decline to publish anything unlawful, abusive, dishonest, or unrelated to the
product. By submitting a review you allow us to publish it on this website.

We do not edit reviews to make them more favourable, and we do not publish fake
ones.

### Acceptable use

Please do not attempt to break into the site, disrupt it, scrape it
systematically, or submit anything unlawful. We may suspend accounts used this
way.

### Our responsibility

We are responsible for supplying the goods you ordered and for loss you suffer
as a foreseeable result of us breaking these terms. We are not responsible for
losses that were not foreseeable, or for business losses.

We do not exclude responsibility for death or personal injury caused by our
negligence, for fraud, or for anything else that cannot lawfully be excluded.

### Your information

We handle your personal information as described in our Privacy Policy.

### Changes

We may change these terms. The version on this page when you order is the one
that applies to that order.

### Governing law

These terms are governed by the laws of the Federal Republic of Nigeria, and
disputes are subject to the jurisdiction of the Nigerian courts.

### Contact

The details for reaching us are on our [Contact page](/contact).
