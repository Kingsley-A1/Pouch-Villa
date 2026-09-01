<title>Open Questions — Client Decisions Required</title>

# Open Questions

Decisions only Pouch Villa can make. Each one states what we do **in the meantime** so that nothing here blocks the build — but the ones marked 🔴 will force rework if answered late.

**Status key:** 🔴 blocking a foundational decision · 🟡 blocks a feature · 🟢 blocks content only

| #   | Question                                           | Impact                  | Status             |
| --- | -------------------------------------------------- | ----------------------- | ------------------ |
| Q1  | Devices or accessories?                            | 🔴 Catalogue schema     | Open               |
| Q2  | Two-tier category mapping sign-off                 | 🟡 Navigation, filters  | Open               |
| Q3  | Is this platform or bizblock the system of record? | 🔴 Inventory, migration | Open               |
| Q4  | Bank account for transfer payment                  | 🟡 Checkout             | Open               |
| Q5  | Who is CEO / Manager / Employee?                   | 🟡 RBAC seeding         | Open               |
| Q6  | Order status vocabulary                            | 🟡 Order state machine  | Open               |
| Q7  | Vector logo + exact brand values                   | 🟡 Design sign-off      | Open               |
| Q8  | Delivery zones, fees, timeframes                   | 🟡 Order totals         | Open               |
| Q9  | Reviews: verified purchase only?                   | 🟢 Reviews              | Open               |
| Q10 | Policy wording — returns, privacy, terms           | 🟢 Supporting pages     | Partially answered |

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
