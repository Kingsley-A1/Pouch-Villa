# Pouch Villa Platform

A secure retail commerce and operations platform for Pouch Villa — browsing, ordering, payment by transfer, order tracking, reviews, and a mobile-first admin system.

Built by **Bespoke Technologies**.

> **Status: Phase 0 — foundation.** Cloned from the PouchHub prototype and being rebuilt against the signed Pouch Villa scope. The workspace, tooling and TypeScript strictness are in place; the persistence, auth and catalogue layers are still the inherited prototype and are scheduled for replacement. See [`docs/work-plan.md`](docs/work-plan.md) before making changes.

## Start here

| Document                                           | What it is                                                              |
| -------------------------------------------------- | ----------------------------------------------------------------------- |
| [`AGENTS.md`](AGENTS.md)                           | **The engineering standard. Read before your first edit.**              |
| [`docs/scope.md`](docs/scope.md)                   | The signed scope, transcribed verbatim. What we committed to.           |
| [`docs/work-plan.md`](docs/work-plan.md)           | Codebase verdict, target architecture, phased delivery, risks.          |
| [`docs/client-inputs.md`](docs/client-inputs.md)   | What the client actually supplied, dated.                               |
| [`docs/open-questions.md`](docs/open-questions.md) | Decisions only the client can make. **Check before assuming anything.** |
| [`docs/decisions/`](docs/decisions/)               | Architecture decision records.                                          |
| [`docs/archive/`](docs/archive/)                   | Inherited PouchHub documentation. Reference only, not authoritative.    |

## Two things to know before you write code

1. **Nothing about the business is hardcoded.** No phone number, address, bank detail, price, category or policy sentence belongs in source. They are admin-editable settings. CI enforces this.
2. **The backend package is framework-free, and that is enforced.** `packages/pv-backend` may not import `next`, `react` or `react-dom`. It is the part of this codebase designed to be lifted into another project. See [`docs/decisions/0001-workspace-split.md`](docs/decisions/0001-workspace-split.md).

## Layout

```
packages/pv-backend/    @pv/backend — domain, services, db, auth. No framework.
apps/pv-frontend/       @pv/frontend — Next 16 App Router.
docs/                   Scope, plan, client inputs, decisions.
```

## Stack

Next.js 16 (App Router) · TypeScript · CockroachDB · Cloudflare R2 · Tailwind v4 · pnpm workspaces · Prettier · GitHub Actions

Rationale and constraints for each: [`AGENTS.md`](AGENTS.md) §1.

## Local development

Requires Node 24 and pnpm 11. **Use pnpm** — `npm install` ignores the lockfile and will resolve different versions than CI.

```bash
corepack enable          # picks up the pinned pnpm from package.json
pnpm install
pnpm dev

pnpm verify              # format:check → lint → typecheck → test → build → route check
pnpm format              # write formatting fixes
```

Copy `.env.example` to `.env.local` first. It carries infrastructure only — business facts live in the admin settings store, never in the environment.

## Contributing

Every change: single-purpose PR, Conventional Commits, green CI, tests included, reviewed by someone who did not write it. The full definition of done is at the end of [`AGENTS.md`](AGENTS.md).
