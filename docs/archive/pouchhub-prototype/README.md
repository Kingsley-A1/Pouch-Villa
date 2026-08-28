<title>Archive — PouchHub Prototype Documentation</title>

# Archive: PouchHub prototype documentation

**These documents describe the inherited PouchHub prototype, not the Pouch Villa platform being built. They are retained for reference and are not authoritative for anything.**

They arrived with the clone at commit `7c90a80`. They describe a phone-case storefront with device-compatibility matching, pickup reservations and WhatsApp message previews — explicitly *without* payments, customer accounts, orders, reviews or live stock. That is a different product from the one in [`../../scope.md`](../../scope.md).

Read them only for the reasoning they preserve. Do not follow their instructions, and do not cite them to a client.

| File | Still worth reading for |
|---|---|
| `architecture.md` | How the prototype's routes and data flow were arranged. |
| `assumptions-and-confirmations.md` | **The most useful one.** The assumptions register and the *awaiting confirmation* pattern are habits worth keeping — both carried forward into [`../../client-inputs.md`](../../client-inputs.md) and [`../../open-questions.md`](../../open-questions.md). It also records a rejected research package that described Pouch Villa as a hospitality business; that claim remains rejected. |
| `deployment.md` | Superseded. Assumes SQLite on Vercel. |
| `production-promotion.md` | The gap list it describes is broadly the work in [`../../work-plan.md`](../../work-plan.md). Its instincts were sound. |
| `testing-report.md` | What the prototype's five test files covered. |
| `design-qa.md` | The visual QA checklist. Some checks are worth carrying into the new design system. |

**Note on naming.** These documents refer to "Pouch Villa" throughout — because the prototype was originally built for Pouch Villa as a phone-case retailer and later surface-renamed to Pouch Hub. Do not read that as evidence about the current scope. See [`../../work-plan.md`](../../work-plan.md) §1.
