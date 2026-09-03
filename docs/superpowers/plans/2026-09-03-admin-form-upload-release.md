# Admin Form and Upload Reliability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship automatic delivery/variant metadata, comma-formatted money inputs, reliable R2 browser uploads, and the requested admin shell/settings refinements.

**Architecture:** Keep business rules in `@pv/backend`, with client components limited to input presentation and upload sequencing. Derive ordering and SKU values transactionally, normalize database money at the SQL boundary, and make R2 CORS an idempotent environment-driven operator command.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Zod, CockroachDB, AWS S3 client for Cloudflare R2, Vitest, Testing Library.

## Global Constraints

- Preserve the dirty main checkout and release from the isolated worktree only.
- Every mutation remains permission-checked and audited server-side.
- Money remains integer kobo after a single explicit conversion boundary.
- Base layout remains usable at 320 px with 44 px interactive targets.
- Do not commit secrets or bucket names.

---

### Task 1: Money decoding and formatted inputs

**Files:**

- Modify: `packages/pv-backend/src/services/delivery.ts`
- Modify: `packages/pv-backend/src/services/products.ts`
- Modify: `packages/pv-backend/src/domain/money.ts`
- Create: `apps/pv-frontend/src/components/admin/money-input.tsx`
- Test: `packages/pv-backend/tests/money.test.ts`
- Test: `apps/pv-frontend/tests/money-input.test.tsx`

**Interfaces:**

- Produces: `parseNairaToKobo(value: string): Kobo` and `MoneyInput` submitting normalized naira text.

- [ ] Write failing tests for Cockroach string decoding and visible `2,500` / submitted `2500` behaviour.
- [ ] Run the focused tests and confirm the expected failures.
- [ ] Cast money columns to `STRING`, convert at the mapper, and implement the reusable input/conversion boundary.
- [ ] Run the focused tests and confirm they pass.

### Task 2: Automatic delivery and variant metadata

**Files:**

- Modify: `packages/pv-backend/src/domain/schemas.ts`
- Modify: `packages/pv-backend/src/services/delivery.ts`
- Modify: `packages/pv-backend/src/services/products.ts`
- Modify: `apps/pv-frontend/src/app/admin/(protected)/delivery/actions.ts`
- Modify: `apps/pv-frontend/src/app/admin/(protected)/delivery/zone-form.tsx`
- Modify: `apps/pv-frontend/src/app/admin/(protected)/products/actions.ts`
- Modify: `apps/pv-frontend/src/app/admin/(protected)/products/variant-form.tsx`
- Test: relevant backend integration and frontend component tests.

**Interfaces:**

- Produces: create-only `generateSku(productName, code)` behaviour and service-owned next sort order.

- [ ] Write failing tests for next ordering, stable edits, location choices, placeholders, and generated SKU shape/uniqueness.
- [ ] Run the focused tests and confirm the expected failures.
- [ ] Remove form-owned SKU/order inputs and implement transactional derivation with collision handling.
- [ ] Run the focused tests and confirm they pass.

### Task 3: R2 upload policy and error handling

**Files:**

- Create: `packages/pv-backend/src/storage/r2-cors.ts`
- Create: `packages/pv-backend/scripts/configure-r2-cors.ts`
- Modify: `packages/pv-backend/package.json`
- Create: `apps/pv-frontend/src/lib/upload-error.ts`
- Modify: product create/edit upload clients and proof upload client.
- Test: focused R2 CORS and upload-error unit tests.

**Interfaces:**

- Produces: an idempotent CORS policy command and `describeUploadFailure(error): string`.

- [ ] Write failing tests for the exact origin/method/header policy and network-failure message.
- [ ] Run the focused tests and confirm the expected failures.
- [ ] Implement the policy builder, operator command, and shared upload error classification.
- [ ] Run focused tests, apply CORS to both configured buckets, and read it back.

### Task 4: Admin header and collapsed settings

**Files:**

- Modify: `apps/pv-frontend/src/app/admin/(protected)/layout.tsx`
- Create: `apps/pv-frontend/src/app/admin/(protected)/settings/editable-settings-section.tsx`
- Modify: settings page/forms.
- Test: admin shell and settings component tests.

**Interfaces:**

- Produces: centered desktop search, two-initial avatar, and closed native disclosures.

- [ ] Write failing UI tests for identity/avatar, centered grid, closed disclosures, and edit controls.
- [ ] Run the focused tests and confirm the expected failures.
- [ ] Implement semantic responsive layout and disclosure sections.
- [ ] Run focused accessibility/component tests at narrow and desktop widths.

### Task 5: Release verification

**Files:**

- Modify only files required by formatter or verified plan corrections.

- [ ] Run `pnpm run verify` and inspect the complete exit status.
- [ ] Review `git diff`, secret patterns, and branch ancestry; commit with a conventional message.
- [ ] Fetch `origin/main`, integrate only if needed, rerun verification, and push this isolated branch to `main`.
- [ ] Verify CI/deployment readiness and smoke-test the affected live routes without claiming authenticated UI behaviour that was not observed.
