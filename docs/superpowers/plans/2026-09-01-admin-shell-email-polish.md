# Admin Shell and Email Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a conventional collapsible desktop admin sidebar, accessible password visibility,
slightly stronger auth corner accents, and one professional transactional-email system without
including any pre-existing dirty-worktree changes.

**Architecture:** Work only in `C:\Users\hp\Documents\PouchVilla-admin-release`, created from
`origin/main`. Keep the server-rendered admin layout and mobile drawer; isolate browser state inside
the existing desktop sidebar and shared password input. Move email presentation into a pure backend
renderer consumed by the Resend boundary so every caller receives the same escaped HTML and
plain-text structure.

**Tech Stack:** Next.js 16.2 App Router, React 19, TypeScript strict, Tailwind v4, Phosphor Icons,
Vitest, Testing Library, Resend HTTP API.

## Global Constraints

- Preserve the dirty primary worktree exactly; only the isolated branch may be committed or pushed.
- Desktop sidebar is 240 px expanded and 72 px collapsed, expanded by default, with a persisted
  preference and 160-180 ms width/label animation.
- Respect `prefers-reduced-motion`; keep interactive controls at least 44 by 44 px.
- Keep the existing mobile admin drawer unchanged.
- Add no business contact, policy, delivery, payment, price, or credential fact.
- Preserve authentication, authorisation, order-state, database, payment, and delivery behaviour.
- Render all dynamic email values through structured blocks that escape HTML exactly once.
- Follow the checked-in Next.js 16 Server/Client Component and CSS guidance already reviewed from
  `node_modules/next/dist/docs/`.

---

### Task 1: Standard desktop admin sidebar

**Files:**

- Modify: `apps/pv-frontend/src/app/admin/(protected)/admin-sidebar.tsx`
- Modify: `apps/pv-frontend/src/app/admin/(protected)/layout.tsx`
- Create: `apps/pv-frontend/tests/admin-sidebar.test.tsx`

**Interfaces:**

- Consumes: `NavSection[]`, `usePathname()`, and local storage key
  `pv-admin-sidebar-open`.
- Produces: `AdminSidebar({ sections }: { sections: NavSection[] })` with expanded and collapsed
  accessible states; no change to the server layout's data contract.

- [ ] **Step 1: Write the failing sidebar behavior tests**

Render the real `AdminSidebar` with two literal sections while mocking only Next's pathname hook.
Assert that it defaults expanded, marks the current route, exposes named 44 px navigation/toggle
controls, persists `false` after collapse, changes its toggle label to `Expand sidebar`, and restores
the collapsed preference on a fresh render. The production regressions caught are a closed first
visit, a non-persistent toggle, or inaccessible icon-only navigation.

- [ ] **Step 2: Run the focused test and confirm RED**

Run:

```powershell
pnpm --filter @pv/frontend test -- tests/admin-sidebar.test.tsx
```

Expected: FAIL because the baseline sidebar does not render the standard icon-rail contract and
does not expose the planned state styling/labels.

- [ ] **Step 3: Implement the standard sidebar**

Use a local `Record<string, Icon>` mapping keyed by route so no React component crosses the Server
Component boundary. Render Phosphor icons with `aria-hidden`, keep text labels available to screen
readers when collapsed, set `title` on collapsed links, and replace text guillemets with
`SidebarSimple`/`CaretLeft`-style icon controls. Use `w-60` expanded and `w-[4.5rem]` collapsed,
`duration-175`, and `motion-reduce:transition-none`.

Reshape the large-screen layout beneath the header into a full-width app shell: the sidebar owns a
sticky, viewport-height, bordered surface while the `<main>` content remains centered at its
existing maximum width. Do not edit `admin-mobile-nav.tsx`.

- [ ] **Step 4: Run the focused test and confirm GREEN**

Run the Task 1 command again. Expected: PASS with no warnings.

- [ ] **Step 5: Commit the sidebar slice**

```powershell
git add -- 'apps/pv-frontend/src/app/admin/(protected)/admin-sidebar.tsx' `
  'apps/pv-frontend/src/app/admin/(protected)/layout.tsx' `
  'apps/pv-frontend/tests/admin-sidebar.test.tsx'
git commit -m "feat(admin): standardize the desktop sidebar"
```

---

### Task 2: Password visibility and stronger auth brackets

**Files:**

- Modify: `apps/pv-frontend/src/components/admin/form-controls.tsx`
- Modify: `apps/pv-frontend/src/app/admin/login/login-form.tsx`
- Modify: `apps/pv-frontend/src/app/admin/claim/claim-form.tsx`
- Modify: `apps/pv-frontend/src/app/globals.css`
- Create: `apps/pv-frontend/tests/password-input.test.tsx`

**Interfaces:**

- Produces: `PasswordInput(props: Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">)`.
- Preserves: native input `name`, `id`, `required`, `minLength`, and `autoComplete` behavior.

- [ ] **Step 1: Write the failing password-control tests**

Render `PasswordInput` with `name="password"`. Assert the field begins as `type="password"`, the
44 px button is named `Show password`, clicking it changes the real input to `type="text"` and the
button name to `Hide password`, and clicking again restores masking. The production regression
caught is a control that submits the form, loses the input contract, or has no accessible state.

- [ ] **Step 2: Run the focused test and confirm RED**

```powershell
pnpm --filter @pv/frontend test -- tests/password-input.test.tsx
```

Expected: FAIL because `PasswordInput` is not exported.

- [ ] **Step 3: Implement the reusable password input**

Add a narrowly scoped client component in the existing client-side form-control module. Wrap the
input in a relative container, reserve right padding, and place a `type="button"` control using
Phosphor `Eye`/`EyeSlash` icons. Keep focus-visible treatment, an accurate `aria-label`, and a
minimum 44 px hit target. Replace only the password inputs in staff login and staff claim.

Change `.panel-bracket::after` from `--weight: 2px` to `--weight: 3px`; preserve its shape, length,
focus behavior, and base one-pixel panel border.

- [ ] **Step 4: Run focused frontend tests and confirm GREEN**

```powershell
pnpm --filter @pv/frontend test -- tests/password-input.test.tsx tests/accessibility.test.tsx
```

Expected: PASS with no automated accessibility violations.

- [ ] **Step 5: Commit the authentication polish**

```powershell
git add -- 'apps/pv-frontend/src/components/admin/form-controls.tsx' `
  'apps/pv-frontend/src/app/admin/login/login-form.tsx' `
  'apps/pv-frontend/src/app/admin/claim/claim-form.tsx' `
  'apps/pv-frontend/src/app/globals.css' `
  'apps/pv-frontend/tests/password-input.test.tsx'
git commit -m "feat(auth): add password visibility controls"
```

---

### Task 3: Shared branded transactional emails

**Files:**

- Create: `packages/pv-backend/src/services/email-template.ts`
- Create: `packages/pv-backend/tests/email-template.test.ts`
- Modify: `packages/pv-backend/tests/staff-login.integration.test.ts`
- Modify: `packages/pv-backend/src/services/email.ts`
- Modify: `packages/pv-backend/src/services/order-email.ts`
- Modify: `packages/pv-backend/src/services/staff-email-verification.ts`

**Interfaces:**

- Produces:
  `renderTransactionalEmail(input: TransactionalEmailInput): { html: string; text: string }`.
- `TransactionalEmailInput` contains `brandName`, `title`, `preheader`, optional `greeting`, and a
  readonly list of structured paragraph, code, details, items, and total blocks.
- `SendEmailInput` replaces raw `html`/`text` with a structured `content` value that omits
  `brandName`; `sendEmail` derives branding from `RESEND_EMAIL_SEND_FROM_NAME`, falling back to the
  configured sender address rather than inventing a brand fact.

- [ ] **Step 1: Write the failing renderer tests**

Use literal hostile fixtures such as `A & <B>` and `<script>alert(1)</script>`. Assert that the HTML
contains the escaped values and no executable tag, has a hidden preheader, table-based outer shell,
brand header, readable title, and email-safe inline styles. Assert that text output contains the same
title, paragraph, code, detail labels/values, item totals, and footer meaning without HTML. The
production regressions caught are injection, missing plain-text information, or bypassing the shared
brand shell.

- [ ] **Step 2: Run the focused test and confirm RED**

```powershell
pnpm --filter @pv/backend test -- tests/email-template.test.ts
```

Expected: FAIL because the renderer module does not exist.

- [ ] **Step 3: Implement the pure renderer**

Create a single-concern module with a discriminated `EmailBlock` union. Escape every string inside
the renderer. Use a 600 px presentation table, preheader, restrained red top rule, configured sender
name, high-contrast heading, rounded content panel, mobile-safe inline spacing, and a quiet footer.
Do not load remote images, embed scripts, or use CSS custom properties.

- [ ] **Step 4: Move every email caller to structured content**

Have `sendEmail` call the renderer immediately before the Resend request. Convert order-created,
payment-confirmed, order-status, password-reset, and staff-verification messages to blocks while
preserving subjects, security wording, expiry durations, bank-setting absence behavior, order line
snapshots, totals, and text meaning. Delete the old raw-HTML escaping helper from `order-email.ts`
after the renderer owns escaping.

- [ ] **Step 5: Run backend tests and confirm GREEN**

```powershell
pnpm --filter @pv/backend test -- tests/email-template.test.ts
pnpm --filter @pv/backend typecheck
```

Expected: renderer tests and backend typecheck PASS.

- [ ] **Step 6: Commit the email slice**

```powershell
git add -- 'packages/pv-backend/src/services/email-template.ts' `
  'packages/pv-backend/tests/email-template.test.ts' `
  'packages/pv-backend/src/services/email.ts' `
  'packages/pv-backend/src/services/order-email.ts' `
  'packages/pv-backend/src/services/staff-email-verification.ts'
git commit -m "feat(email): add branded transactional templates"
```

---

### Task 4: Release verification and isolated push

**Files:**

- Modify only if formatting requires it: files already listed in Tasks 1-3
- Verify: all commits since `origin/main`

**Interfaces:**

- Produces: one isolated branch whose commits contain only the approved spec, plan, tests, admin UI,
  auth control, and email-template work.

- [ ] **Step 1: Format and inspect the exact release diff**

```powershell
pnpm exec prettier --write `
  'docs/superpowers/specs/2026-09-01-admin-shell-email-polish-design.md' `
  'docs/superpowers/plans/2026-09-01-admin-shell-email-polish.md' `
  'apps/pv-frontend/src/app/admin/(protected)/admin-sidebar.tsx' `
  'apps/pv-frontend/src/app/admin/(protected)/layout.tsx' `
  'apps/pv-frontend/src/components/admin/form-controls.tsx' `
  'apps/pv-frontend/src/app/admin/login/login-form.tsx' `
  'apps/pv-frontend/src/app/admin/claim/claim-form.tsx' `
  'apps/pv-frontend/src/app/globals.css' `
  'apps/pv-frontend/tests/admin-sidebar.test.tsx' `
  'apps/pv-frontend/tests/password-input.test.tsx' `
  'packages/pv-backend/src/services/email-template.ts' `
  'packages/pv-backend/tests/email-template.test.ts' `
  'packages/pv-backend/src/services/email.ts' `
  'packages/pv-backend/src/services/order-email.ts' `
  'packages/pv-backend/src/services/staff-email-verification.ts'
git diff --check origin/main...HEAD
git diff --stat origin/main...HEAD
git status --short
```

Commit any formatter-only changes with `style: format admin and email release`.

- [ ] **Step 2: Run the full repository gate**

```powershell
pnpm run verify
```

Expected: format, lint, TypeScript, business-fact scan, all tests, production build, and route checks
all exit 0. If worker pressure appears, use the documented supported `--maxWorkers=1` path rather
than changing test semantics.

- [ ] **Step 3: Confirm isolation and remote ancestry**

```powershell
git fetch origin
git log --oneline origin/main..HEAD
git diff --name-status origin/main...HEAD
git merge-base --is-ancestor origin/main HEAD
git status --short --branch
```

Expected: only approved release files; clean isolated worktree; origin/main is an ancestor.

- [ ] **Step 4: Push the isolated branch head directly to main**

```powershell
git push origin HEAD:main
git fetch origin
git rev-list --left-right --count HEAD...origin/main
git status --short --branch
```

Expected: push succeeds, parity is `0 0`, and the isolated worktree is clean.

- [ ] **Step 5: Report exact evidence**

Report the pushed SHA, commit list, verification output summary, remote parity, and the untouched
dirty primary-worktree boundary. Do not claim a Vercel deployment or live browser result without
separate evidence.
