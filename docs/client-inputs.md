<title>Client Inputs — Pouch Villa</title>

# Client Inputs

Everything the client has actually supplied, transcribed and dated. Source files live in [`client/`](client/). This is evidence, not interpretation — where an input contradicts the signed scope, the contradiction is recorded here and escalated in [`open-questions.md`](open-questions.md).

---

## 1. Signed scope

`docs/client/Pouch_Villa_Platform_Project_Scope.pdf` — transcribed verbatim in [`scope.md`](scope.md).

---

## 2. Brand assets — received 2026-08-28

| File                             | Description                                                 | Production-ready?                        |
| -------------------------------- | ----------------------------------------------------------- | ---------------------------------------- |
| `client/brand/logo-red-3d.jpg`   | White wordmark + case mark, extruded, on red field          | ❌ Raster, 3D treatment, no transparency |
| `client/brand/logo-alt.jpg`      | Alternate lockup                                            | ❌ Raster                                |
| `client/brand/logo-flat-red.jpg` | **Flat red wordmark + case mark on white** — the usable one | ⚠️ Raster only; needs vectorising        |
| `client/brand/og-supplied.jpg`   | Supplied social/OG image                                    | ⚠️ Needs regeneration at spec            |

**Mark:** a tilted phone-case outline with a triple camera cutout, filled at the base with a poured-liquid shape — a visual pun on _pouch_ / _villa_. Wordmark is a high-contrast slab serif (Clarendon-adjacent), "POUCH" over "VILLA".

**Palette observed:** a saturated red (approximately `#E8112D`–`#EE1C25` as sampled from JPEG, so **not authoritative**) on white.

> **Blocking for design sign-off:** no vector source (SVG/AI/EPS), no exact brand hex values, no typeface licence, no clear-space or minimum-size rules, no mono/knockout variant. Sampling a hex from a JPEG is a guess and will not survive print or a brand review. Requested in [`open-questions.md`](open-questions.md) Q7.

---

## 3. Live product taxonomy — received 2026-08-28

The client runs an existing POS at **bizblock.com.ng** with **33 category records** (IDs 1–38, with gaps from deletions). Transcribed from `client/reference/bizblock-categories-*.jpg`:

| ID  | Category                   | Parent   |
| --- | -------------------------- | -------- |
| 1   | Chargers                   | —        |
| 2   | Screen Guards              | —        |
| 3   | Earpiece                   | —        |
| 4   | Extension Socket           | —        |
| 5   | Power Bank                 | —        |
| 6   | Tripod                     | —        |
| 7   | Watch Strap                | —        |
| 8   | Smart Watch                | —        |
| 9   | Airpod Case                | —        |
| 10  | LED Light                  | —        |
| 11  | Camera Guard               | —        |
| 12  | Flash Drive                | —        |
| 13  | Battery                    | Chargers |
| 14  | Car Charger                | Chargers |
| 15  | Adapters / Docking Station | —        |
| 16  | Earbuds                    | —        |
| 17  | Pouch Accessories          | —        |
| 18  | Android Phone Case         | —        |
| 19  | Otterbox Defender Case     | —        |
| 21  | BT Speakers                | —        |
| 22  | Mouse                      | —        |
| 23  | MiFi                       | —        |
| 24  | Clipper                    | —        |
| 25  | Laptop Bag                 | —        |
| 29  | IPhone Case                | —        |
| 32  | Samsung pouch              | —        |
| 33  | Ipad Case                  | —        |
| 34  | SD Card                    | —        |
| 35  | Tv Accessories             | —        |
| 36  | Ps5 Cd                     | —        |
| 37  | Google Pixel Case          | —        |
| 38  | Headset                    | Earbuds  |

_(ID 20 and 26–28, 30–31 are absent from the client's export — deleted records. Row count shown by bizblock is 33.)_

### The client's own restructure

In the _Pouch Villa Store_ WhatsApp group (2026-08-28, 13:48–13:54), the client — "GEEKS 'N' GADGETS BOSS" — asked for the 33 flat categories to collapse into **two top-level categories**:

**1. 👜 POUCHES & PROTECTION** — _"This should be the main category."_
Samsung Pouch · Pouch Accessories · iPhone Case · Android Phone Case · Google Pixel Case · OtterBox Defender Case · iPad Case · AirPod Case · Screen Guards · Camera Guard · Laptop Bag · Watch Strap

**2. 🔌 GADGETS & ACCESSORIES** — _"Everything else."_
Chargers · Power Bank · Earpiece · Earbuds · Headset · BT Speakers · Smart Watch · MiFi · Flash Drive · SD Card · Battery · Car Charger · Adapters / Docking Station · Extension Socket · Tripod · LED Light · TV Accessories · PS5 CD · Clipper

Confirmed in-thread: _"2 categories. Generally first."_

### Notes on data quality

The incumbent taxonomy is inconsistent and should not be imported as-is:

- **Wrong parenting.** `Headset → Earbuds` is a sibling relationship, not a hierarchy. `Battery → Chargers` conflates a consumable with a charging device.
- **Mixed axes.** `OtterBox Defender Case` is a _brand + model_ masquerading as a category, alongside generic `Android Phone Case`.
- **Orphans.** `Mouse`, `Clipper`, `PS5 CD`, `TV Accessories` sit outside the stated two-category model and need an explicit home.
- **Casing drift.** `IPhone Case`, `Ipad Case`, `Ps5 Cd`, `Samsung pouch`.
- **`Mouse` is absent** from the client's own two-category restructure but present in the POS.

The two-tier mapping must be signed off by the client before it drives navigation — see [`open-questions.md`](open-questions.md) Q2.

---

## 4. ⚠️ Material conflict: what does Pouch Villa sell?

This is the single most consequential open item on the project, and it must be resolved before the catalogue schema is written.

| Source                                          | Says                                                                                                                                                           |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Signed scope PDF**                            | _"…discovering, ordering and managing **mobile devices**."_ Variant axes given as **"Storage, colour, condition"** — the classic new/refurbished handset axes. |
| **Client's live POS + restructure (same week)** | 33 categories, **not one of which is a phone, tablet or any other device**. The stated main category is _Pouches & Protection_.                                |

These cannot both be the primary catalogue.

- "Storage, colour, condition" is meaningless for a screen protector and essential for a handset.
- Device-compatibility filtering ("show me cases for my iPhone 15 Pro") is the make-or-break feature if accessories dominate, and near-worthless if handsets dominate.
- Refurbished-handset retail carries obligations — IMEI tracking, battery health disclosure, grading standards, warranty terms — that accessory retail does not.

**Engineering position:** we do not guess, and we do not block. The catalogue is designed so that _both_ readings are expressible from day one — variants are first-class rows carrying their own price and stock, variant **axes are data rather than columns**, and device compatibility is an **optional facet** on any product. That costs little now and avoids a schema rewrite either way. Rationale in [`work-plan.md`](work-plan.md) §3.

**Client decision still required** — [`open-questions.md`](open-questions.md) Q1.

---

## 5. ⚠️ System-of-record conflict

The client is **actively running bizblock.com.ng** for POS and inventory. The scope commits us to _"Products & Catalogue — create, edit, price, availability"_ and _"Orders"_, which describes the same job.

Nobody has stated which system wins. The three possibilities carry very different costs:

1. **Website is the system of record.** Pouch Villa stops using bizblock for catalogue and stock. One-time migration, cleanest build, real change-management cost for staff.
2. **bizblock stays the system of record.** We build a read path and sync. Requires a bizblock API or export that we have not seen and may not exist.
3. **Both, split by domain** — e.g. POS owns in-store stock, website owns online. Requires a reconciliation rule for every shared SKU. The most expensive and the most common way this goes wrong.

Until this is answered, **stock is modelled as a single authoritative quantity owned by this platform**, with a documented seam for later sync. Escalated as [`open-questions.md`](open-questions.md) Q3.

---

## 6. Not yet supplied

Blocking or near-blocking, in rough priority order:

| #   | Item                                                          | Blocks                             |
| --- | ------------------------------------------------------------- | ---------------------------------- |
| 1   | Answer on devices vs accessories (§4)                         | Catalogue schema                   |
| 2   | System-of-record decision (§5)                                | Inventory model, migration plan    |
| 3   | Bank account details for transfer payment                     | Checkout — scope item 08           |
| 4   | Named CEO account holder + the two other admin identities     | RBAC seeding                       |
| 5   | Vector logo, exact brand hex, typeface licence                | Design sign-off, favicon, OG       |
| 6   | Real product data, photography, prices                        | Launch content                     |
| 7   | Official phone, WhatsApp, email, address, hours               | Contact page, footer, order emails |
| 8   | Delivery zones, fees, timeframes                              | Checkout totals                    |
| 9   | Returns / warranty / refund policy wording                    | Terms & Conditions page            |
| 10  | Privacy policy inputs — retention, lawful basis, NDPR posture | Privacy page                       |
| 11  | Order-status vocabulary matching how they actually operate    | Order state machine                |
| 12  | Production domain + DNS control                               | Deployment, OAuth callbacks        |

**Rule for the build:** never invent any of these. Missing operational data renders as an explicit _awaiting confirmation_ state, and every one of them is admin-editable at runtime — no contact detail, price, policy line or business fact is ever hardcoded. See [`AGENTS.md`](../AGENTS.md) § _No hardcoded business facts_.
