<title>Pouch Villa — Operations Runbook</title>

# Operations Runbook

For whoever is on the end of the phone when something is wrong. Written to be
followed under pressure by someone who did not build this.

**Audience:** Bespoke Technologies engineers, and the Pouch Villa CEO for the
sections marked _CEO_.
**Companion documents:** [`../ARCHITECTURE.md`](../ARCHITECTURE.md) for how the
system is put together, [`security-review.md`](security-review.md) for the threat
assessment, [`../AGENTS.md`](../AGENTS.md) for the engineering standard.

> **Status, 2026-09-03.** The backup and restore drill in §6 has been **written
> but not performed**. Until it has been run and timed, treat the recovery time
> in this document as an estimate, not a commitment. It is the single most
> important thing outstanding in this file.

---

## 1. What this system is made of

| Piece                 | Where it runs   | What breaks if it is down                 |
| --------------------- | --------------- | ----------------------------------------- |
| Next.js application   | Vercel          | Everything                                |
| CockroachDB Cloud     | Managed cluster | Everything; the app fails loudly          |
| Cloudflare R2 public  | Object storage  | Product images stop loading               |
| Cloudflare R2 private | Object storage  | Payment proofs cannot be seen or sent     |
| Resend                | Email provider  | Every email; the app keeps working        |
| Google OAuth          | Google Cloud    | Google sign-in only; passwords still work |

**The application never fails because email failed.** Every send is
fire-and-forget by design. An order is placed, a proof is rejected and a password
is changed whether or not Resend is reachable.

**The application always fails if the database is unreachable.** There is no
local fallback and no silent degradation, deliberately: the prototype this
replaced fell back to an in-memory database and lost orders without telling
anyone.

---

## 2. First response — the shape of every incident

1. **Is it everything, or one thing?** Open the storefront home page and
   `/admin/login`. If both fail, it is the app or the database. If only images
   are missing, it is R2. If only email is missing, it is Resend.
2. **Check the platform status pages** before investigating code: Vercel,
   CockroachDB Cloud, Cloudflare, Resend.
3. **Read the deployment log** for the current release. A failure that started at
   a deploy is a failure caused by that deploy.
4. **Say something.** Tell the CEO what is broken, what still works, and when you
   will next report. A silent engineer is worse than a broken shop.
5. Work the specific section below.

**Never debug by deploying.** Roll back first, then investigate on a copy.

---

## 3. Symptom → cause

### The whole site returns an error

Almost always the database or a missing environment variable.

- Production **refuses to start without `AUTH_SECRET`**. That is deliberate: a
  weak or derived signing key is a session-forgery risk. If the app will not
  boot after a config change, check this first.
- `DATABASE_URL is not configured` in the logs means exactly that. There is no
  fallback.
- Connection timeouts to CockroachDB: check the cluster's status page, then
  whether the deployment's IP allow-list still includes Vercel.

### The site loads but every page is slow

Latency on this cluster is per statement, 2–3 seconds even warm. A page that
issues many queries feels broken. Check the deploy that preceded the slowdown
for a new query in a loop.

### Product images are missing, everything else works

R2 public bucket or the CDN in front of it. The app renders a storefront without
pictures rather than a 500 on every page — `isStorageConfigured()` returns false
and images are omitted. Check `R2_ENDPOINT`, `R2_PUBLIC_BUCKET_NAME` and
`R2_PUBLIC_BASE_URL`.

### Staff cannot upload a product image

The browser uploads **directly to R2** with a pre-signed URL; the bytes never
pass through the application server. Two things break it:

- The Content Security Policy's `connect-src` no longer covers the bucket host.
  The browser console names the blocked origin. `lib/security-headers.ts` builds
  this from `R2_ENDPOINT`.
- R2 CORS rules do not allow `PUT` from the site's origin.

### Google sign-in fails with "Access blocked: Authorisation error"

`Error 400: origin_mismatch`. The origin the app is served from is not listed
under **Authorised JavaScript origins** on the OAuth client in the Google Cloud
Console. Scheme, host and port must match exactly, with no trailing slash, and
`http` and `https` are different origins. **There is nothing to change in the
repository** — this failure happens inside Google's own popup, which our code
cannot see or report.

### Nobody is receiving email

Check Resend's dashboard for delivery failures, then the sending domain's SPF,
DKIM and DMARC records. Application logs record only the error **name**, never a
recipient or a token, so the provider dashboard is the place to look.

Staff alerts (an enquiry waiting, a proof waiting) go to `RESEND_EMAIL_SEND_TO`.
**If that variable is unset they are skipped silently** — a shop with no
configured inbox loses an alert rather than failing the customer action that
triggered it. Confirm it is set.

### A page renders but is visibly unstyled, or a button does nothing

Look at the browser console for a Content Security Policy violation. The policy
is strict and carries a per-request nonce. Two ways to break it:

- Somebody added a `style` attribute. A nonce cannot address `style-src-attr`;
  use classes.
- Somebody added a hand-written `<script>` without the nonce. Next only nonces
  what Next emits; read `x-nonce` from `headers()`.

### A customer says they paid but the order still says awaiting payment

Working as designed until staff confirm it. Check **Payments & Proofs** in the
admin. If a proof was rejected the customer was emailed the staff reason and the
order was returned to awaiting payment so they do not pay twice.

### Staff member cannot sign in

- Five failed attempts per email per fifteen minutes locks the attempt, read from
  the audit trail. Wait it out.
- A suspended account has had every session revoked. Check **Staff**.
- An unverified account needs its email code. Codes expire; resending has a
  60-second cooldown.

---

## 4. Rolling back — _CEO may authorise, engineer performs_

The fastest safe action when a deploy broke something.

1. In Vercel, open the project's deployment list.
2. Find the last deployment that was known good.
3. **Promote it to production.**
4. Confirm the storefront and `/admin/login` both load.
5. Tell the CEO the shop is back and that the cause is still being investigated.

**A rollback does not undo a migration.** Migrations are forward-only by design.
If the bad deploy included one, read §7 before doing anything else.

---

## 5. Suspending a person's access immediately — _CEO_

If a staff member must lose access now:

1. Sign in to the admin, open **Staff**.
2. Press **Suspend** on their row.
3. Write the message, or press the button that suspends without one.

Suspension **ends every one of their sessions in the same transaction** as the
status change. It does not wait for a token to expire. The action is in the audit
trail with your name on it, along with anything you wrote.

If the account is a CEO account, the system will refuse if it would leave the
business with none. That guard is deliberate and cannot be overridden from the
interface.

---

## 6. Backup and restore

> **Not yet performed.** Everything below is the procedure to follow, written to
> be executed as the drill. Record the real timings in §6.4 when it is run.

### 6.1 What must be recoverable

| Data                     | Where it lives    | Loss tolerance                     |
| ------------------------ | ----------------- | ---------------------------------- |
| Orders, customers, audit | CockroachDB       | None. This is the business record. |
| Catalogue and settings   | CockroachDB       | None, and expensive to re-enter    |
| Product images           | R2 public bucket  | Re-uploadable, at real staff cost  |
| Payment proofs           | R2 private bucket | None — financial documents         |

### 6.2 Backups

- **CockroachDB Cloud takes managed backups.** Confirm the retention window and
  the restore-point granularity on the cluster, and write both here. Do not
  assume; a backup nobody has checked is a hope.
- **R2 buckets are not backed up by this application.** Enable object versioning
  on both buckets, and confirm the private bucket's lifecycle rules do not expire
  payment proofs before the retention period the privacy policy commits to.

### 6.3 The restore drill

Run this against a **new, empty database**. Never against production.

1. Provision a fresh CockroachDB database and note the time.
2. Restore the most recent managed backup into it.
3. Point a preview deployment at it with `DATABASE_URL`.
4. Verify, and record each one:
   - The storefront home page renders the catalogue.
   - A known order opens at `/orders/<reference>` with the right total.
   - The admin dashboard shows the expected counts.
   - A payment proof opens through its signed URL.
   - `pnpm --filter @pv/backend db:migrate` reports no pending migrations.
5. Record the wall-clock time from step 1 to a verified step 4.
6. Destroy the restored database and the preview deployment.

### 6.4 Drill record

| Date | Performed by | Backup restored | Time to verified | Notes             |
| ---- | ------------ | --------------- | ---------------- | ----------------- |
| —    | —            | —               | —                | Not yet performed |

---

## 7. Database changes

Migrations are **forward-only and checksummed**. The migrator refuses to run if a
file that has already been applied has changed, so an edited migration is caught
rather than silently skipped.

- To apply: `pnpm run db:migrate`.
- **Never edit an applied migration.** Write a new one.
- **Never write a destructive migration without separate approval.** Dropping a
  column drops the data in it, and a rollback of the application code will not
  bring it back.
- Schema changes in CockroachDB are online and asynchronous. A migration
  returning does not mean the change has fully propagated; a large index can take
  minutes more.

**If a bad deploy included a migration**, roll the application back first, then
decide whether the schema change is compatible with the older code. Additive
changes usually are. If it is not, you need a forward fix, not a rollback.

---

## 8. Secrets

- Secrets live in the deployment platform's environment configuration, never in
  the repository and never in a log or an error message.
- `AUTH_SECRET` signs sessions. **Rotating it signs everybody out**, staff and
  customers alike. That is the correct response to a suspected leak; it is not
  something to do casually on a Friday afternoon.
- Rotating `R2_SECRET_ACCESS_KEY` invalidates in-flight pre-signed URLs. Uploads
  in progress will fail and can be retried.
- Rotating `RESEND_API_KEY` is safe at any time. Email is best-effort.
- `BOOTSTRAP_CEO_EMAIL` pins who may redeem a CEO role code. Keep it set.

**A role code is never emailed.** It is shown once on screen and carried out of
band — read aloud, or typed into the phone in front of you. That is deliberate:
a code seen in a mailbox or a log would otherwise be enough to create a staff
account.

---

## 9. Suspected security incident

1. **Do not delete anything.** The audit trail is append-only and is the record.
2. Suspend the accounts involved (§5). This revokes their sessions immediately.
3. If a session token or `AUTH_SECRET` may have leaked, **rotate `AUTH_SECRET`**.
   Everyone is signed out; that is the point.
4. If R2 credentials may have leaked, rotate them and audit access to the private
   bucket. Payment proofs are financial documents containing bank details.
5. Export the relevant audit records before anything else changes.
6. Write down what happened, when it was noticed, and what was done, as you go.
   Reconstructing it afterwards is much harder than it sounds.

**Never put a password, token, session id, full bank detail or payment-proof URL
into a ticket, a chat message or a log** while investigating. That is how an
incident becomes a second incident.

---

## 10. Routine checks

**Daily — _CEO or a manager_**

- Payments & Proofs: anything waiting to be confirmed.
- Orders: anything stuck in a state longer than it should be.
- Contact requests: anything unanswered.

**Weekly — engineer**

- CI is green on `main`.
- Lighthouse artefacts from the latest run: the numbers should be moving toward
  the budgets, not away.
- Resend delivery failures.

**Monthly — engineer**

- Dependency updates, especially Next and the database driver.
- Confirm backups still exist and the retention window is what §6.2 records.
- Re-read §6.4. If the last drill is more than six months old, run it again.
