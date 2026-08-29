<title>ADR 0001 — pv-backend / pv-frontend workspace split</title>

# ADR 0001 — Split the codebase into `pv-backend` and `pv-frontend`

**Date:** 2026-08-29 · **Status:** Accepted · **Supersedes:** the single-package layout in `AGENTS.md` §7

## Context

`AGENTS.md` §1 requires a written decision record to deviate from the committed
structure. This records that deviation.

Two forces drove it:

1. **Separation of concern.** Business logic reachable only through a React form has
   to be rewritten to serve a POS sync or a mobile client. `AGENTS.md` §3 already
   required services to import nothing from `next/*`; nothing _enforced_ it.
2. **Reuse.** This codebase will be cloned as the starting point for another
   project. A framework-free package with its own manifest is liftable. A
   `src/server/` directory inside a Next app is not.

## Decision

A pnpm workspace with two members, deployed as one unit:

```
packages/pv-backend/     @pv/backend — framework-free
  src/domain/            types, formatting, checked accessors
  src/auth/              sessions, permissions, password hashing
  src/db/                schema, queries, seed
apps/pv-frontend/        @pv/frontend — Next 16 App Router
  src/app/               routes, and api/v1 from Phase 0
  src/components/        presentational
  src/lib/               browser-side helpers
  src/server/            thin adapters over @pv/backend
```

**One deployable, not two.** The alternative — a standalone HTTP API with the
frontend calling it over the network — was rejected for V1. It adds a network hop to
every server render, doubles the auth surface across two origins, and costs
materially more Phase 0 time. The package boundary already delivers the separation;
promoting `pv-backend` to its own service later is additive, because nothing in it
knows how it is being called.

## Enforcement

The boundary is checked, not merely documented:

- `pv-backend` has no dependency on `next`, `react` or `react-dom` in its manifest.
- ESLint bans importing `next`, `next/*`, `react` and `react-dom` from
  `packages/pv-backend/**`, and bans the `@/*` alias there so its imports stay
  relative and portable.
- `packages/pv-backend/src/index.ts` deliberately omits the database layer. Server
  code reaches it through the explicit `@pv/backend/db` entry point, so a driver or
  credential cannot arrive in a Client Component through a barrel import.

## Consequences

- `pv-backend` ships TypeScript source, so `pv-frontend` lists it in
  `transpilePackages`. No build step, no stale artefact.
- Each package owns its own `tsconfig.json`, `vitest.config.mts` and test suite,
  both extending `tsconfig.base.json`.
- Recursive scripts run with `--workspace-concurrency=1`; the concurrent runner hung
  on Windows.
