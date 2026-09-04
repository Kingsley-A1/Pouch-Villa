<title>Open Questions — Client Decisions Required</title>

# Open Questions

Decisions only Pouch Villa can make. Each one states what we do **in the meantime** so that nothing here blocks the build — but the ones marked 🔴 will force rework if answered late.

**Status key:** 🔴 blocking a foundational decision · 🟡 blocks a feature · 🟢 blocks content only

| #   | Question                                                | Impact                  | Status             |
| --- | ------------------------------------------------------- | ----------------------- | ------------------ |
| Q1  | Devices or accessories?                                 | 🔴 Catalogue schema     | Open               |
| Q2  | Two-tier category mapping sign-off                      | 🟡 Navigation, filters  | Open               |
| Q3  | Is this platform or bizblock the system of record?      | 🔴 Inventory, migration | Open               |
| Q4  | Bank account for transfer payment                       | 🟡 Checkout             | Open               |
| Q5  | Who is CEO / Manager / Employee?                        | 🟡 RBAC seeding         | Open               |
| Q6  | Order status vocabulary                                 | 🟡 Order state machine  | Open               |
| Q7  | Vector logo + exact brand values                        | 🟡 Design sign-off      | Open               |
| Q8  | Delivery zones, fees, timeframes                        | 🟡 Order totals         | Open               |
| Q9  | Reviews: verified purchase only?                        | 🟢 Reviews              | Open               |
| Q10 | Policy wording — returns, privacy, terms                | 🟢 Supporting pages     | Partially answered |
| Q11 | Email staff when their access changes?                  | 🟢 Staff notification   | Answered           |
| Q12 | Should a staff sign-in also sign them in as a customer? | 🟡 Identity boundary    | Open               |

---

### 🔴 Q1 — Does Pouch Villa sell mobile devices, accessories, or both?

The signed scope says _"managing mobile devices"_ with variants _"storage, colour, condition"_. The client's own live POS taxonomy, sent the same week, contains **zero device categories** and names _Pouches & Protection_ as the main category. See [`client-inputs.md`](client-inputs.md) §4.

**Ask them exactly this:** _"Will the website sell actual phones and tablets — or only cases, pouches and accessories? If phones: new, refurbished, or both?"_ No Phones.

**Meanwhile:** variant axes are stored as data, not columns, and device compatibility is an optional facet. Both answers remain buildable without a schema rewrite. If the answer is "refurbished handsets", that adds IMEI capture, battery-health disclosure and a condition-grading standard — material extra scope, and it is better priced now than discovered in month two.

---

### 🟡 Q2 — Confirm the two-tier category mapping

The client asked for 33 flat categories to collapse into _Pouches & Protection_ and _Gadgets & Accessories_. Four categories have no stated home — **Mouse, Clipper, PS5 CD, TV Accessories** — and `Mouse` was dropped from their own restructure entirely. Two parent links in the incumbent data are wrong (`Headset → Earbuds`, `Battery → Chargers`). Answer; There should be `Others` category, any product with nudefiend category goes there, straight. We are also bankig on ease of use. A product that is being uploaded should have the miniaml input fields, that will substitue us from over-building and in turn will make it easy for Pouch Villa and its staffs. They see design more than they see Archtecture, lets make the two a wow-effect. Ass much as possible, there shouldnt be any uncessaasryu page. If a review can be completed in the home page with the via a clean modal, that have its input field in a progressive screen, lets not force users to go the review page before the can air thier view.
Where there is need, we should create and use a reusable progressive disclosure animation.  
**Ask:** sign off the full 33-row mapping, including the four orphans, and confirm whether `OtterBox Defender Case` is a category or a brand filter.

**Meanwhile:** categories are admin-managed rows with a parent link, so remapping is an admin action and never a deployment.

---

### 🔴 Q3 — Which system is authoritative for products and stock?

Pouch Villa actively uses **bizblock.com.ng**. The scope commits us to catalogue and order management — the same job. See [`client-inputs.md`](client-inputs.md) §5.

**Ask:** _"After launch, where does a staff member add a new product and change stock — here, or bizblock? If bizblock stays, does it offer an API or scheduled export?"_ The website has and sho never have a business with Bizblock, we engineer everything they need.

**Meanwhile:** this platform holds one authoritative stock quantity per variant, with all mutations funnelled through a single ledger seam so an external sync can be added later without touching call sites.

---

### 🟡 Q4 — Bank account for "Pay by Transfer"

Scope item 08 names a _"Pouch Villa account"_. We have no account name, number or bank.

**Ask:** account name, number, bank, and whether it differs by order value or channel.

**Meanwhile:** bank details are an admin-editable setting rendered at checkout. Checkout shows an _awaiting confirmation_ state rather than any placeholder — we will never render an invented account number, even in staging.
It will be set at .env and the stil managed by admin in setting
---

### 🟡 Q5 — Who holds the CEO, Manager and Employee accounts?

Scope requires three admin tiers with the CEO defining the other two. We have no names or emails.

**Ask:** the CEO's email (this account cannot be self-service created), plus initial managers and employees. Every accout should be self created, and a CEO account should be only one account. Pouch Villa wprkers selct thier role during registration and the env-backed regsitration code is what that will justify the role, from both CEO and other workers.

**Meanwhile:** the CEO account is provisioned by an explicit, audited bootstrap command — never seeded from an environment variable, and never a default credential.
Each account should be gated by 8 digit code + eamil + password for registration, and email + passord or Google Auth for sign in.

---

### 🟡 Q6 — What are the real order statuses?

Scope says _"Track Order — status & completion"_ without naming states. Inventing a state machine that does not match how they actually work makes the admin unusable.

**Ask:** walk us through one real order from message to hand-over, naming each step and who performs it. Include how a failed or partial transfer is handled, and whether orders can be edited after placement.

**Meanwhile:** the state machine is a single typed transition table with an audit trail — cheap to change, provided it changes before real orders exist.

User places order, chooses home delivery(delivery fee set by admin and shown when users chooses home delivery, location: lga, landmarks) or pick up, pays into the account number, uploads the payment prove, registerd phone, location and delivery intent, and admin sees it in the thier payment confirmation page, accepts it and user gets Email notification that payment is reciewd
---

### 🟡 Q7 — Vector logo and exact brand values

We have JPEGs only. A hex sampled from a JPEG is a guess. See [`client-inputs.md`](client-inputs.md) §2.

**Ask:** SVG/AI/EPS source, exact brand hex values, typeface name and licence, clear-space and minimum-size rules, and a mono/knockout variant for the favicon and dark surfaces.

**Meanwhile:** the design system is built on semantic CSS custom properties. Landing the real brand values is editing a token file, not touching components.
Use the exact available logos available. The font in this codebaseis accpeted. Both dark and light theme should be supported out-of-the-box.
---

### 🟡 Q8 — Delivery zones, fees and timeframes

An order total cannot be computed without them.

**Ask:** which areas are served, what each costs, expected timeframes, whether pickup is offered, and any free-delivery threshold.

**Meanwhile:** delivery is an admin-managed zone/fee table. Orders are placed with a delivery line item that resolves to zero until the table is populated. Exactly.

---

### 🟢 Q9 — Who may leave a review?

Scope says _"Review Product — approve and manage feedback"_, so moderation is confirmed; eligibility is not.

**Ask:** may anyone with an account review, or only a verified purchaser? Are reviews held for approval before publication, or published then moderated? Anyone can review. Reviews held for approval before publication

**Answered, and built.** See [`decisions/0005-order-lifecycle-and-reviews.md`](decisions/0005-order-lifecycle-and-reviews.md) §3. Anyone may review — no account, no sign-in wall — and every review is held for approval before publication. Spam control is that moderation plus per-IP and per-product rate limiting.

> The previous "meanwhile" text here said reviews _"require an authenticated account"_. That contradicted the client's own answer above and was never built; it is corrected rather than left standing.

---

### 🟢 Q10 — Policy wording

About, Privacy Policy and Terms & Conditions are committed deliverables. We will not draft legally operative text on the client's behalf.

**Ask:** returns and warranty terms, refund window, data retention period, and who owns data-protection responsibility under NDPR. This should be done with the bets infomation available, searching what is teh current standrd today, and admins should be able to edit/add to the the pages content when they need to change something.

**Partially answered.** See [`decisions/About-Policy.md`](decisions/About-Policy.md): the About Us copy and the full Return & Warranty policy — 7-day return window for faulty goods, no change-of-mind refunds, 3-day manufacturing-defect-only warranty with named exclusions, replacement rather than cash refund — have landed from the client and are ready to build. That document is explicit that it covers About and Return & Warranty only, and does not extend to privacy, delivery, payments or general legal terms — so the Privacy Policy wording and the NDPR data-retention/responsibility question are still open.

**Still to ask:** Privacy Policy wording, data retention period, and who owns data-protection responsibility under NDPR.

**Meanwhile:** the received content is filed here for **Phase 4** ([`work-plan.md`](work-plan.md) §4), where the supporting pages are built. It is not yet wired into the settings store or rendered — see the work-plan for what that involves, including a new `policy.returns` settings key and new `/about` and `/returns` routes, since Return & Warranty is content distinct from Terms & Conditions and was never given its own key. Privacy still renders its _awaiting confirmation_ notice, unaffected by this answer.

---

### 🟢 Q11 — Should staff be emailed when their access changes? _(answered)_

Raised by us on 2026-09-02 while closing the notification gaps in
[`decisions/0008-device-finder-and-notifications.md`](decisions/0008-device-finder-and-notifications.md),
and deliberately not answered by a default.

Every other silent state change in the system now sends a message. Two on the
staff side are still silent, and both are the client's call rather than ours:

- **A suspended account.** Suspension ends every session immediately, which is
  correct, and the person learns of it by being signed out. Whether they should
  also get an email is a decision about how Pouch Villa wants to part with
  someone, not an engineering gap.
- **A minted role code.** This one we recommend leaving alone. `BOOTSTRAP_CEO_EMAIL`
  pins who may redeem a CEO code precisely so that a code seen in a mailbox or a
  log is not by itself enough to create an account. Emailing the code hands that
  guarantee away. Carrying it out of band — read aloud, or typed into the phone
  in front of you — is the stronger process and costs the CEO nothing.

**Ask:** should a suspended or reactivated staff member be emailed, and in whose
words? Yes, themain should be compoased by the CEO in the spot where the staff access is being changed, and it sends through an establised email template.

**Answered 2026-09-02, and built.** The CEO writes the message where the change
is made — the Suspend and Reactivate controls on `/admin/staff` open a composer
rather than acting immediately — and it goes out through the same transactional
template as every other message.

Three things follow from the answer that are worth recording, because they were
decisions rather than transcription:

- **The message is optional.** Access must never stay open because nobody could
  find the right words, so the button is always live and reads "Suspend without
  a message" when the field is empty. A blank field sends nothing, exactly as
  before.
- **The email carries no link and no code.** A suspension notice is the one
  message deliberately sent to someone the business has just stopped trusting,
  at an address that may no longer be theirs. It says what happened and repeats
  the CEO's words; anything more would be a way back in that outlives the
  mailbox. The composer says so above the field.
- **What was written is audited.** The message is stored on the
  `staff.status_changed` audit record as well as sent, so the account of an
  access change does not live only in one person's mailbox.

**The role-code half stands as recommended:** a minted code is still shown once
on screen and carried out of band, never emailed.

---

### 🟡 Q12 — Should signing into the admin also sign a staff member in as a customer?

Raised by us on 2026-09-04, from the client's review note: _"When an admin is
signed in in the admin portal, it should still be signed in on the public side."_

The report is fair — the CEO signs into the admin, opens the shop, and is shown
a **Sign in** prompt. What they are seeing is [`AGENTS.md`](../AGENTS.md) §5
working as specified: customers and staff share no session, cookie, table or code
path, so a privilege bug in the storefront cannot reach the admin.

**Ask them exactly this:** _"When you are signed into the admin and you open the
shop, do you want it simply to show that you are signed in as staff — or do you
want to be able to shop, add to a cart and place a real order without signing in
again?"_

**Done already, and enough for the first reading:** the storefront now recognises
a staff session and says so, in a bar above the header with a link back to the
admin. It grants nothing: no cart, no order history, no account pages. See
[`decisions/0014-staff-visibility-on-the-storefront.md`](decisions/0014-staff-visibility-on-the-storefront.md).

**What the second reading would cost.** It means linking a staff account to a
customer account the same person owns, and a staff sign-in minting that customer
session alongside the staff one. The boundary that matters survives — the
storefront would still only ever see a customer session, so a storefront bug
still could not reach the admin — but two things change, and the client should
decide them rather than us:

1. Compromising a staff sign-in would also yield that person's customer account.
   Strictly less privileged than the admin, but no longer nothing.
2. Redeeming a role code would implicitly create a second identity, which §5
   forbids today. Answering yes here means amending §5 in writing, as
   [`decisions/0002-access-and-verification.md`](decisions/0002-access-and-verification.md)
   did for Google sign-in.

**Meanwhile:** a staff member who wants to buy something signs into the shop with
their own customer account, exactly as any other customer does. Nothing is
blocked; it is one extra sign-in.
