# Admin Global Search and Additive KPIs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a reusable, permission-safe global admin search while retaining the current dashboard totals and adding operational KPIs, centred Google OAuth controls, and a cleaner dashboard heading.

**Architecture:** A derived `admin_search_document` table holds bounded, safe search projections maintained in the same transaction as source mutations. `@pv/backend` owns route-neutral search types, permission re-derivation, indexing, backfill, and rebuilding; the Next application owns the authenticated API route, result-to-route mapping, and responsive combobox. Dashboard queries remain consolidated for CockroachDB latency.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict mode, CockroachDB, Zod, Tailwind v4, Vitest, Testing Library, pnpm workspaces.

## Global Constraints

- Start from `origin/main` SHA `0fa4b8fdd10f7d96e3666b127b23a80dc4bda1b5` in `PouchVilla-admin-search-release`.
- The backend imports nothing from `next/*` or React and returns no frontend URL.
- The server re-derives search permissions from the active staff record on every query.
- Search results are capped at 20; client requests begin at two trimmed characters after 250 ms.
- Never index or return passwords, tokens, sessions, bank details, proof locations, setting values, enquiry messages, review bodies, or audit payloads.
- Money remains integer kobo; confirmed-payment states alone contribute to revenue.
- Base UI targets 360 px and must remain usable at 320 px, keyboard-only, and reduced motion.
- Migration `0008_admin_search.sql` is forward-only and must be applied before code that queries the index is deployed.
- Every production behavior follows RED, GREEN, REFACTOR and ends with an isolated conventional commit.

---

### Task 1: Search contract, schema, and projection core

**Files:**

- Create: `packages/pv-backend/migrations/0008_admin_search.sql`
- Create: `packages/pv-backend/src/services/admin-search.ts`
- Create: `packages/pv-backend/src/services/admin-search-index.ts`
- Create: `packages/pv-backend/tests/admin-search.test.ts`
- Create: `packages/pv-backend/tests/admin-search.integration.test.ts`

**Interfaces:**

- Produces: `AdminSearchEntity`, `AdminSearchResult`, `searchAdmin(actorStaffId, input)`.
- Produces: `syncAdminSearchDocument(tx, entity, entityId)`, `removeAdminSearchDocument(tx, entity, entityId)`, and `rebuildAdminSearchIndex()`.
- Consumes: `PermissionCode`, `Queryable`, `query`, and `withTransaction`.

- [ ] **Step 1: Write failing contract and normalization tests**

  Assert that whitespace-only/one-character input returns no results, limits clamp to `1..20`, entity values are a closed union, and safe result objects expose only `entity`, `entityId`, `title`, `context`, and `requiredPermission`.

- [ ] **Step 2: Run the focused unit test and confirm RED**

  Run: `pnpm --filter @pv/backend test -- tests/admin-search.test.ts`

  Expected: FAIL because `services/admin-search` does not exist.

- [ ] **Step 3: Add the migration and route-neutral types**

  Create a derived table keyed by `(entity_type, entity_id)` with `title`, nullable `context`, `search_text`, `required_permission`, and timestamps. Add a stored `to_tsvector('simple', search_text)` column, inverted vector index, and trigram title index. Add fixed entity and permission checks plus idempotent `INSERT ... SELECT ... ON CONFLICT` backfills for every source named in the spec.

  Implement:

  ```ts
  export type AdminSearchInput = { query: string; limit?: number };
  export async function searchAdmin(
    actorStaffId: string,
    input: AdminSearchInput,
  ): Promise<AdminSearchResult[]>;
  ```

  The SQL must join the current active staff row and `role_permission`, filter by the document's required permission, use full-text rank plus title similarity, and never interpolate a table or column name.

- [ ] **Step 4: Add fixed source projectors and index operations**

  `admin-search-index.ts` contains an exhaustive static projector map. Each projector uses a complete prepared statement to produce one safe document or `null`; no caller supplies a table or column. `syncAdminSearchDocument` upserts or removes the derived document using the caller's transaction.

- [ ] **Step 5: Write and run CockroachDB integration tests**

  Cover migration/backfill, exact and fuzzy results, 20-result cap, inactive staff, role permission changes, and no cross-permission leakage. Skip only through the repository's existing `TEST_DATABASE_URL` gate.

- [ ] **Step 6: Run backend tests and typecheck, then commit**

  Run:

  ```text
  pnpm --filter @pv/backend test -- tests/admin-search.test.ts tests/admin-search.integration.test.ts
  pnpm --filter @pv/backend typecheck
  ```

  Commit: `feat(search): add reusable admin search index`

### Task 2: Keep the search index synchronized

**Files:**

- Modify: `packages/pv-backend/src/services/products.ts`
- Modify: `packages/pv-backend/src/services/brands.ts`
- Modify: `packages/pv-backend/src/services/categories.ts`
- Modify: `packages/pv-backend/src/services/devices.ts`
- Modify: `packages/pv-backend/src/services/delivery.ts`
- Modify: `packages/pv-backend/src/services/orders.ts`
- Modify: `packages/pv-backend/src/services/payments.ts`
- Modify: `packages/pv-backend/src/services/customers.ts`
- Modify: `packages/pv-backend/src/services/customer-account.ts`
- Modify: `packages/pv-backend/src/services/staff-access.ts`
- Modify: `packages/pv-backend/src/services/staff-login.ts`
- Modify: `packages/pv-backend/src/services/reviews.ts`
- Modify: `packages/pv-backend/src/services/contact.ts`
- Modify: `packages/pv-backend/src/services/settings.ts`
- Create: `packages/pv-backend/scripts/rebuild-admin-search.ts`
- Modify: `packages/pv-backend/package.json`
- Create: `packages/pv-backend/tests/admin-search-sync.integration.test.ts`

**Interfaces:**

- Consumes: `syncAdminSearchDocument`, `removeAdminSearchDocument`, and `rebuildAdminSearchIndex` from Task 1.
- Produces: transactional search consistency and `pnpm --filter @pv/backend search:rebuild`.

- [ ] **Step 1: Write failing synchronization tests**

  For each entity family, create a record through its public service, search it, rename/status-change it, search the new identity/context, soft-delete it, and assert it disappears. Include linked refreshes: SKU changes refresh products; brand changes refresh devices; order/payment status changes refresh their documents.

- [ ] **Step 2: Run the focused integration test and confirm RED**

  Run: `pnpm --filter @pv/backend test -- tests/admin-search-sync.integration.test.ts`

  Expected: FAIL because source mutations do not update search documents.

- [ ] **Step 3: Add index updates to existing retry-aware transactions**

  Place projection calls after the canonical row change and before transaction return. Convert a mutation to `withTransaction` only where necessary, preserving its existing audit record in that same transaction. On soft deletion call `removeAdminSearchDocument`; do not index deleted rows.

- [ ] **Step 4: Add the bounded rebuild command**

  `rebuild-admin-search.ts` loads environment files, calls `rebuildAdminSearchIndex`, prints entity counts only, never search text, and always closes the pool. Add:

  ```json
  "search:rebuild": "node --import tsx scripts/rebuild-admin-search.ts"
  ```

- [ ] **Step 5: Run synchronization tests and backend verification, then commit**

  Run:

  ```text
  pnpm --filter @pv/backend test -- tests/admin-search-sync.integration.test.ts tests/admin-search.integration.test.ts
  pnpm --filter @pv/backend typecheck
  ```

  Commit: `feat(search): synchronize admin search documents`

### Task 3: Authenticated admin search API

**Files:**

- Modify: `packages/pv-backend/src/domain/schemas.ts`
- Create: `apps/pv-frontend/src/app/api/v1/admin/search/route.ts`
- Create: `apps/pv-frontend/tests/admin-search-route.test.ts`

**Interfaces:**

- Consumes: `getStaffPrincipal()` and `searchAdmin(actorStaffId, { query, limit })`.
- Produces: `GET /api/v1/admin/search?q=<query>` returning `{ results: AdminSearchResult[] }`.

- [ ] **Step 1: Write failing route tests**

  Assert 401 without a staff session, 400 for malformed/oversized query input, an empty array below two characters, a maximum of 20 results, and a generic 500 response with no driver detail.

- [ ] **Step 2: Run the route test and confirm RED**

  Run: `pnpm --filter @pv/frontend test -- tests/admin-search-route.test.ts --maxWorkers=1`

  Expected: FAIL because the route does not exist.

- [ ] **Step 3: Implement the Node-only route**

  Parse `request.url` with a Zod schema, require an active staff principal without redirecting an API client, apply the existing rate-limit service with a per-staff bucket, call `searchAdmin`, and return cache-disabled JSON. Do not log the query.

- [ ] **Step 4: Run route tests, frontend typecheck, and commit**

  Commit: `feat(search): expose authenticated admin search API`

### Task 4: Responsive global search component

**Files:**

- Create: `apps/pv-frontend/src/components/admin/admin-search-routes.ts`
- Create: `apps/pv-frontend/src/components/admin/admin-search.tsx`
- Modify: `apps/pv-frontend/src/app/admin/(protected)/layout.tsx`
- Create: `apps/pv-frontend/tests/admin-search.test.tsx`
- Modify: `apps/pv-frontend/tests/accessibility.test.tsx`

**Interfaces:**

- Consumes: authorised `NavSection[]` and the Task 3 API.
- Produces: `AdminSearch({ sections }: { sections: NavSection[] })`.

- [ ] **Step 1: Write failing component and routing tests**

  Assert route mapping for every entity, local navigation matching, the two-character/debounce contract, stale request cancellation, grouped results, loading/empty/error states, arrow/Enter/Escape behavior, `/` and Command/Ctrl+K shortcuts, focus restoration, and 44-pixel mobile control.

- [ ] **Step 2: Run the focused frontend test and confirm RED**

  Run: `pnpm --filter @pv/frontend test -- tests/admin-search.test.tsx --maxWorkers=1`

  Expected: FAIL because `AdminSearch` does not exist.

- [ ] **Step 3: Implement route mapping and the accessible component**

  Use semantic search input and labelled listbox/option behavior, `AbortController`, 250 ms debounce, no client data library, and `createPortal` for the mobile dialog. Unknown entities return `null` from the route mapper and are not rendered.

- [ ] **Step 4: Mount it in the shared admin header**

  Give the search region flexible centred space without moving the brand link or staff/logout/mobile controls. Pass the server-filtered `sections`; do not send the full navigation catalogue to the client.

- [ ] **Step 5: Run focused tests, accessibility tests, typecheck, and commit**

  Commit: `feat(admin): add global search component`

### Task 5: Additive dashboard KPIs

**Files:**

- Modify: `apps/pv-frontend/src/app/admin/(protected)/page.tsx`
- Modify: `packages/pv-backend/src/services/dashboard.ts`
- Create: `apps/pv-frontend/src/app/admin/(protected)/dashboard-view-model.ts`
- Create: `apps/pv-frontend/tests/admin-dashboard.test.ts`
- Modify: `packages/pv-backend/tests/checkout.integration.test.ts`

**Interfaces:**

- Consumes: existing counts plus `readDashboardTotals`, `readAttentionQueues`, and `readLowStock`.
- Produces: `buildDashboardSections(...)` retaining all five overview cards and adding operational sections.

- [ ] **Step 1: Write a failing additive dashboard test**

  Provide complete and permission-limited fixtures. Assert that Products, Categories, Brands, Active staff, and Customers remain; sales/order figures are added; zero attention items are omitted; and no inaccessible card or queue appears.

- [ ] **Step 2: Run the focused test and confirm RED**

  Run: `pnpm --filter @pv/frontend test -- tests/admin-dashboard.test.ts --maxWorkers=1`

  Expected: FAIL because the existing dashboard replaced three overview cards and has no view-model contract.

- [ ] **Step 3: Implement the pure view model and update the page**

  Restore category, brand, and active-staff loads behind their existing permissions. Render `Needs you`, `Sales & orders`, `Overview`, and `Running low` in the approved order. Remove the entire role/admin subtitle beneath the welcome heading.

- [ ] **Step 4: Verify consolidated SQL semantics**

  Keep revenue/order totals in one scan, queue counts in one scan, and low stock bounded at eight. Add/adjust integration assertions proving awaiting-payment money is excluded and confirmed money is included.

- [ ] **Step 5: Run focused tests and commit**

  Commit: `feat(admin): make dashboard KPIs additive`

### Task 6: Centre Google OAuth controls

**Files:**

- Modify: `apps/pv-frontend/src/components/google-sign-in-button.tsx`
- Create: `apps/pv-frontend/tests/google-sign-in-button.test.tsx`

**Interfaces:**

- Produces: the existing `GoogleSignInButton` API with a responsive centred host.

- [ ] **Step 1: Write the failing alignment test**

  Stub Google's renderer, provide a 280-pixel host, and assert the renderer receives 280; provide a 400-pixel host and assert 320. Assert the host remains centred and the pending/error text does not change its alignment.

- [ ] **Step 2: Run the focused test and confirm RED**

  Run: `pnpm --filter @pv/frontend test -- tests/google-sign-in-button.test.tsx --maxWorkers=1`

  Expected: FAIL because the renderer always receives 320 and its host is left-aligned.

- [ ] **Step 3: Implement measured responsive centring**

  Render Google's button into a full-width flex-centred host. Measure available width before `renderButton` and pass `Math.min(320, availableWidth)`. Preserve the existing credential callback, pending state, error state, and public-client-ID security boundary.

- [ ] **Step 4: Run focused and accessibility tests, then commit**

  Commit: `fix(auth): centre responsive Google sign-in`

### Task 7: Complete verification, migration, and deployment

**Files:**

- Modify only if evidence requires: `docs/work-plan.md`

**Interfaces:**

- Consumes: all previous tasks.
- Produces: verified isolated commit on remote `main`, migrated production database, and live route evidence.

- [ ] **Step 1: Read current Next.js 16 guidance and inspect the isolated diff**

  Read the relevant Server/Client Component, route-handler, CSS, and accessibility guides under `apps/pv-frontend/node_modules/next/dist/docs/`. Run `git diff --check origin/main...HEAD` and confirm every file belongs to this release.

- [ ] **Step 2: Run complete local verification**

  Run: `pnpm run verify`

  Record exact passed, failed, and environment-gated counts. Do not promote with any runnable failure.

- [ ] **Step 3: Verify migration safety against a disposable/TEST CockroachDB database**

  Apply through `pnpm --filter @pv/backend db:migrate`, run `search:rebuild`, execute the permission matrix, re-run migration to prove idempotence, and inspect only schema/index names and counts.

- [ ] **Step 4: Fetch and re-check ancestry**

  Run `git fetch origin`, require `git merge-base --is-ancestor origin/main HEAD`, and stop if remote main has diverged. Confirm the primary worktree is untouched.

- [ ] **Step 5: Apply production migration before application promotion**

  Use the configured deployment environment without printing secrets. Apply migration 0008 and rebuild the index; record only migration names, elapsed time, and entity counts. If production database access is unavailable, stop before deploying code that requires the table.

- [ ] **Step 6: Push only the isolated release and verify deployment**

  Push `HEAD:main`, confirm local/remote SHA parity, inspect the production deployment until Ready, and verify login, claim, and authenticated admin/search behavior without fabricating a session or exposing credentials.

- [ ] **Step 7: Final clean-state check**

  Confirm `git status --short`, `git rev-list --left-right --count HEAD...origin/main`, and the exact deployed SHA. Report any route or database behavior that could not be proven live.
