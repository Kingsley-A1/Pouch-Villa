# Pouch Villa Platform

A secure retail commerce and operations platform for Pouch Villa — browsing, ordering, payment by transfer, order tracking, reviews, and a mobile-first admin system.

Built by **Bespoke Technologies**.

> **Status: Phase 0 — foundation.** This repository was cloned from the PouchHub prototype and is being rebuilt against the signed Pouch Villa scope. Most of the inherited application code is scheduled for replacement. See [`docs/work-plan.md`](docs/work-plan.md) before making changes.

## Start here

| Document | What it is |
|---|---|
| [`AGENTS.md`](AGENTS.md) | **The engineering standard. Read before your first edit.** |
| [`docs/scope.md`](docs/scope.md) | The signed scope, transcribed verbatim. What we committed to. |
| [`docs/work-plan.md`](docs/work-plan.md) | Codebase verdict, target architecture, phased delivery, risks. |
| [`docs/client-inputs.md`](docs/client-inputs.md) | What the client actually supplied, dated — including two material conflicts. |
| [`docs/open-questions.md`](docs/open-questions.md) | Decisions only the client can make. **Check before assuming anything.** |
| [`docs/archive/`](docs/archive/) | Inherited PouchHub documentation. Reference only, not authoritative. |

## Two things to know before you write code

1. **Nothing about the business is hardcoded.** No phone number, address, bank detail, price, category or policy sentence belongs in source. They are admin-editable settings. CI enforces this.
2. **What Pouch Villa sells is not yet settled.** The signed scope says *mobile devices*; the client's live POS taxonomy says *cases and accessories*. See [`docs/open-questions.md`](docs/open-questions.md) Q1. The catalogue schema is deliberately designed to absorb either answer — do not collapse it to one.

## Stack

Next.js 16 (App Router) · TypeScript · CockroachDB · Cloudflare R2 · Google OAuth · Tailwind v4 · GitHub Actions

Rationale and constraints for each: [`AGENTS.md`](AGENTS.md) §1.

## Local development

> ⚠️ The commands below are inherited from the PouchHub prototype and still target its SQLite setup. They are replaced in Phase 0 — see [`docs/work-plan.md`](docs/work-plan.md) §4.

```bash
npm install
npm run dev
npm run verify     # lint → typecheck → test → build → route check
```

## Contributing

Every change: single-purpose PR, Conventional Commits, green CI, tests included, reviewed by someone who did not write it. The full definition of done is at the end of [`AGENTS.md`](AGENTS.md).
