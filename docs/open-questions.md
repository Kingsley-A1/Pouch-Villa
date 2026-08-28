<title>Open Questions — Client Decisions Required</title>

# Open Questions

Decisions only Pouch Villa can make. Each one states what we do **in the meantime** so that nothing here blocks the build — but the ones marked 🔴 will force rework if answered late.

**Status key:** 🔴 blocking a foundational decision · 🟡 blocks a feature · 🟢 blocks content only

| # | Question | Impact | Status |
|---|----------|--------|--------|
| Q1 | Devices or accessories? | 🔴 Catalogue schema | Open |
| Q2 | Two-tier category mapping sign-off | 🟡 Navigation, filters | Open |
| Q3 | Is this platform or bizblock the system of record? | 🔴 Inventory, migration | Open |
| Q4 | Bank account for transfer payment | 🟡 Checkout | Open |
| Q5 | Who is CEO / Manager / Employee? | 🟡 RBAC seeding | Open |
| Q6 | Order status vocabulary | 🟡 Order state machine | Open |
| Q7 | Vector logo + exact brand values | 🟡 Design sign-off | Open |
| Q8 | Delivery zones, fees, timeframes | 🟡 Order totals | Open |
| Q9 | Reviews: verified purchase only? | 🟢 Reviews | Open |
| Q10 | Policy wording — returns, privacy, terms | 🟢 Supporting pages | Open |

---

### 🔴 Q1 — Does Pouch Villa sell mobile devices, accessories, or both?

The signed scope says *"managing mobile devices"* with variants *"storage, colour, condition"*. The client's own live POS taxonomy, sent the same week, contains **zero device categories** and names *Pouches & Protection* as the main category. See [`client-inputs.md`](client-inputs.md) §4.

**Ask them exactly this:** *"Will the website sell actual phones and tablets — or only cases, pouches and accessories? If phones: new, refurbished, or both?"*

**Meanwhile:** variant axes are stored as data, not columns, and device compatibility is an optional facet. Both answers remain buildable without a schema rewrite. If the answer is "refurbished handsets", that adds IMEI capture, battery-health disclosure and a condition-grading standard — material extra scope, and it is better priced now than discovered in month two.

---

### 🟡 Q2 — Confirm the two-tier category mapping

The client asked for 33 flat categories to collapse into *Pouches & Protection* and *Gadgets & Accessories*. Four categories have no stated home — **Mouse, Clipper, PS5 CD, TV Accessories** — and `Mouse` was dropped from their own restructure entirely. Two parent links in the incumbent data are wrong (`Headset → Earbuds`, `Battery → Chargers`).

**Ask:** sign off the full 33-row mapping, including the four orphans, and confirm whether `OtterBox Defender Case` is a category or a brand filter.

**Meanwhile:** categories are admin-managed rows with a parent link, so remapping is an admin action and never a deployment.

---

### 🔴 Q3 — Which system is authoritative for products and stock?

Pouch Villa actively uses **bizblock.com.ng**. The scope commits us to catalogue and order management — the same job. See [`client-inputs.md`](client-inputs.md) §5.

**Ask:** *"After launch, where does a staff member add a new product and change stock — here, or bizblock? If bizblock stays, does it offer an API or scheduled export?"*

**Meanwhile:** this platform holds one authoritative stock quantity per variant, with all mutations funnelled through a single ledger seam so an external sync can be added later without touching call sites.

---

### 🟡 Q4 — Bank account for "Pay by Transfer"

Scope item 08 names a *"Pouch Villa account"*. We have no account name, number or bank.

**Ask:** account name, number, bank, and whether it differs by order value or channel.

**Meanwhile:** bank details are an admin-editable setting rendered at checkout. Checkout shows an *awaiting confirmation* state rather than any placeholder — we will never render an invented account number, even in staging.

---

### 🟡 Q5 — Who holds the CEO, Manager and Employee accounts?

Scope requires three admin tiers with the CEO defining the other two. We have no names or emails.

**Ask:** the CEO's email (this account cannot be self-service created), plus initial managers and employees.

**Meanwhile:** the CEO account is provisioned by an explicit, audited bootstrap command — never seeded from an environment variable, and never a default credential.

---

### 🟡 Q6 — What are the real order statuses?

Scope says *"Track Order — status & completion"* without naming states. Inventing a state machine that does not match how they actually work makes the admin unusable.

**Ask:** walk us through one real order from message to hand-over, naming each step and who performs it. Include how a failed or partial transfer is handled, and whether orders can be edited after placement.

**Meanwhile:** the state machine is a single typed transition table with an audit trail — cheap to change, provided it changes before real orders exist.

---

### 🟡 Q7 — Vector logo and exact brand values

We have JPEGs only. A hex sampled from a JPEG is a guess. See [`client-inputs.md`](client-inputs.md) §2.

**Ask:** SVG/AI/EPS source, exact brand hex values, typeface name and licence, clear-space and minimum-size rules, and a mono/knockout variant for the favicon and dark surfaces.

**Meanwhile:** the design system is built on semantic CSS custom properties. Landing the real brand values is editing a token file, not touching components.

---

### 🟡 Q8 — Delivery zones, fees and timeframes

An order total cannot be computed without them.

**Ask:** which areas are served, what each costs, expected timeframes, whether pickup is offered, and any free-delivery threshold.

**Meanwhile:** delivery is an admin-managed zone/fee table. Orders are placed with a delivery line item that resolves to zero until the table is populated.

---

### 🟢 Q9 — Who may leave a review?

Scope says *"Review Product — approve and manage feedback"*, so moderation is confirmed; eligibility is not.

**Ask:** may anyone with an account review, or only a verified purchaser? Are reviews held for approval before publication, or published then moderated?

**Meanwhile:** reviews require an authenticated account, are linked to an order line where one exists, and default to **held for approval** — the conservative choice, and a setting rather than a rewrite.

---

### 🟢 Q10 — Policy wording

About, Privacy Policy and Terms & Conditions are committed deliverables. We will not draft legally operative text on the client's behalf.

**Ask:** returns and warranty terms, refund window, data retention period, and who owns data-protection responsibility under NDPR.

**Meanwhile:** the pages exist, are admin-editable, and render an explicit *awaiting confirmation* notice rather than plausible-sounding invented policy.
