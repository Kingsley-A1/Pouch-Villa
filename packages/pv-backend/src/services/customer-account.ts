import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { assertPasswordNotBreached } from "../auth/breach-check";
import { verifyGoogleIdToken } from "../auth/google";
import { hashPassword, needsRehash, verifyPassword } from "../auth/password";
import { revokeAllCustomerSessions } from "../auth/customer-session";
import { getPool, queryOne, type Queryable } from "../db/client";
import { withTransaction } from "../db/transaction";
import { normalisePhone } from "../domain/phone";
import { recordAudit } from "./audit";
import { assertWithinRateLimit, recordRateLimitHits } from "./rate-limit";

/**
 * Customer identity: email + password, or Google, with password recovery.
 *
 * Per ADR 0002 this is deliberately the *opposite* treatment from staff. There
 * is no role code, no 2FA, and **no email verification** — an inbox round-trip
 * in the middle of checkout is the single most expensive step we could add, and
 * nothing about ordering depends on proving the address.
 *
 * The consequence is stated rather than hidden: because the address is
 * unverified it is not an identity proof. Order tracking is authorised by the
 * order reference plus the registered phone, never by email alone.
 *
 * Like the staff equivalent, these functions verify identity and record it. They
 * do not issue a session — that sets a cookie, which is the frontend adapter's
 * job.
 */

export type AuthenticatedCustomer = { customerId: string };

export class InvalidCustomerCredentialsError extends Error {
  constructor() {
    super("That email or password is incorrect.");
    this.name = "InvalidCustomerCredentialsError";
  }
}

export class EmailAlreadyRegisteredError extends Error {
  constructor() {
    super("An account already exists for that email address. Sign in instead.");
    this.name = "EmailAlreadyRegisteredError";
  }
}

export class CustomerSuspendedError extends Error {
  constructor() {
    super("This account is not available. Please contact us.");
    this.name = "CustomerSuspendedError";
  }
}

export type RequestContext = { ip?: string | undefined; requestId?: string | undefined };

/**
 * An email is hashed before it becomes a rate-limit subject. The IP is not: staff
 * need it in the clear for an abuse investigation, and it is already recorded in
 * the audit trail. An email address in a sweepable counter table is personal
 * data with no such justification.
 */
function rateLimitSubject(email: string): string {
  return createHash("sha256").update(email).digest("hex");
}

type CustomerAuthRow = {
  id: string;
  email: string;
  password_hash: string | null;
  status: string;
};

export type SignUpInput = {
  email: string;
  password: string;
  fullName?: string | null;
  phone?: string | null;
};

export async function signUp(
  input: SignUpInput,
  context: RequestContext = {},
): Promise<AuthenticatedCustomer> {
  const email = input.email.trim().toLowerCase();
  const subjects = [context.ip, rateLimitSubject(email)];
  await assertWithinRateLimit("customer.signup", subjects);

  // Both of these are slow and neither touches the database, so they happen
  // before the transaction opens rather than inside a body that may be retried.
  await assertPasswordNotBreached(input.password);
  const passwordHash = await hashPassword(input.password);
  const phone = input.phone ? normalisePhone(input.phone) : null;

  await recordRateLimitHits("customer.signup", subjects);

  return withTransaction(async (tx) => {
    const existing = await tx.query(
      "SELECT id FROM customer WHERE email = $1 AND deleted_at IS NULL",
      [email],
    );
    if (existing.rows.length > 0) throw new EmailAlreadyRegisteredError();

    const inserted = await tx.query(
      `INSERT INTO customer (email, full_name, phone, phone_normalised, password_hash,
                             account_source, consented_at)
            VALUES ($1, $2, $3, $3, $4, 'self_signup', now())
         RETURNING id`,
      [email, input.fullName ?? null, phone, passwordHash],
    );
    const customerId = (inserted.rows[0] as { id: string }).id;

    await recordAudit(tx, {
      actorType: "customer",
      actorId: customerId,
      action: "customer.registered",
      entityType: "customer",
      entityId: customerId,
      after: { accountSource: "self_signup" },
      requestId: context.requestId,
      ip: context.ip,
    });

    return { customerId };
  });
}

export async function loginCustomerWithPassword(
  email: string,
  password: string,
  context: RequestContext = {},
): Promise<AuthenticatedCustomer> {
  const normalised = email.trim().toLowerCase();
  const subjects = [context.ip, rateLimitSubject(normalised)];
  await assertWithinRateLimit("customer.login", subjects);

  const customer = await queryOne<CustomerAuthRow>(
    "SELECT id, email, password_hash, status FROM customer WHERE email = $1 AND deleted_at IS NULL",
    [normalised],
  );

  /**
   * An account created at checkout or through Google has no password hash. A
   * password attempt against it must fail exactly as a wrong password does, or
   * the response tells an attacker which addresses exist and how they sign in.
   */
  const storedHash = customer?.password_hash ?? null;

  if (customer === null || storedHash === null || !(await verifyPassword(password, storedHash))) {
    await recordRateLimitHits("customer.login", subjects);
    throw new InvalidCustomerCredentialsError();
  }
  if (customer.status !== "active") throw new CustomerSuspendedError();

  const upgradedHash = needsRehash(storedHash) ? await hashPassword(password) : null;

  if (upgradedHash !== null) {
    await withTransaction(async (tx) => {
      await tx.query("UPDATE customer SET password_hash = $2, updated_at = now() WHERE id = $1", [
        customer.id,
        upgradedHash,
      ]);
    });
  }

  return { customerId: customer.id };
}

/**
 * Google for customers. Unlike the staff path, this **may create an account** —
 * a customer account carries no authority, so proving control of a mailbox is
 * enough to have one. A staff account still requires a redeemed role code, and
 * this lookup never touches the `staff` table.
 */
export async function loginCustomerWithGoogle(
  idToken: string,
  context: RequestContext = {},
): Promise<AuthenticatedCustomer> {
  const { subject, email, emailVerified, fullName } = await verifyGoogleIdToken(idToken);

  return withTransaction(async (tx) => {
    const byGoogle = await tx.query(
      "SELECT id, status FROM customer WHERE google_subject = $1 AND deleted_at IS NULL",
      [subject],
    );
    let row = byGoogle.rows[0] as { id: string; status: string } | undefined;

    if (row === undefined && emailVerified) {
      // Links an account created at checkout or with a password, but only where
      // Google itself has verified that mailbox.
      const byEmail = await tx.query(
        `UPDATE customer SET google_subject = $1, updated_at = now()
              WHERE email = $2 AND deleted_at IS NULL AND google_subject IS NULL
          RETURNING id, status`,
        [subject, email],
      );
      row = byEmail.rows[0] as { id: string; status: string } | undefined;
    }

    if (row === undefined) {
      const created = await tx.query(
        `INSERT INTO customer (email, full_name, google_subject, account_source, consented_at)
              VALUES ($1, $2, $3, 'self_signup', now())
           RETURNING id, status`,
        [email, fullName, subject],
      );
      row = created.rows[0] as { id: string; status: string };
      await recordAudit(tx, {
        actorType: "customer",
        actorId: row.id,
        action: "customer.registered",
        entityType: "customer",
        entityId: row.id,
        after: { accountSource: "self_signup", via: "google" },
        requestId: context.requestId,
        ip: context.ip,
      });
    }

    if (row.status !== "active") throw new CustomerSuspendedError();
    return { customerId: row.id };
  });
}

/**
 * Finds or creates the customer behind an order, for ADR 0002's ticked-by-default
 * "Create my Pouch Villa account" checkbox.
 *
 * Runs inside the checkout transaction, so an order and its account commit
 * together or not at all. `consented_at` records that the box was ticked and
 * when — the distinction NDPR draws between a default and a silent creation.
 */
export async function findOrCreateCustomerForOrder(
  tx: Queryable,
  input: { email: string; fullName: string; phone: string },
): Promise<string> {
  const email = input.email.trim().toLowerCase();

  const existing = await tx.query(
    "SELECT id FROM customer WHERE email = $1 AND deleted_at IS NULL",
    [email],
  );
  const found = existing.rows[0] as { id: string } | undefined;
  if (found !== undefined) {
    // An existing account keeps its own name; only a missing phone is filled in,
    // because the order just proved this number reaches them.
    await tx.query(
      `UPDATE customer
          SET phone = coalesce(phone, $2),
              phone_normalised = coalesce(phone_normalised, $2),
              updated_at = now()
        WHERE id = $1`,
      [found.id, input.phone],
    );
    return found.id;
  }

  const created = await tx.query(
    `INSERT INTO customer (email, full_name, phone, phone_normalised, account_source, consented_at)
          VALUES ($1, $2, $3, $3, 'checkout', now())
       RETURNING id`,
    [email, input.fullName, input.phone],
  );
  return (created.rows[0] as { id: string }).id;
}

// ---------------------------------------------------------------------------
// Password recovery. Code-based, on the same reasoning as ADR 0002's staff
// verification: a magic link leaks through shared inboxes and forwarded mail,
// breaks in in-app browsers, and is phishable in a way a code typed into a page
// the user already has open is not.
// ---------------------------------------------------------------------------

const RESET_CODE_TTL_MS = 15 * 60 * 1000;
const RESET_MAX_ATTEMPTS = 5;

function hashResetCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

/** Six digits, from a CSPRNG. `randomInt` is rejection-sampled, so unbiased. */
function generateResetCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export class InvalidResetCodeError extends Error {
  constructor() {
    super("That code is not valid or has expired. Request a new one.");
    this.name = "InvalidResetCodeError";
  }
}

/**
 * Always resolves, whether or not the address is registered. Telling a caller
 * that an address is unknown turns this into an account-enumeration oracle, and
 * the person who genuinely owns the address learns nothing from the difference.
 *
 * Returns the code only when one was issued, for the caller to send by email.
 * It is never returned to the browser.
 */
export async function requestPasswordReset(
  email: string,
  context: RequestContext = {},
): Promise<{ customerId: string; code: string } | null> {
  const normalised = email.trim().toLowerCase();
  const subjects = [context.ip, rateLimitSubject(normalised)];
  await assertWithinRateLimit("customer.password_reset", subjects);
  await recordRateLimitHits("customer.password_reset", subjects);

  const customer = await queryOne<{ id: string }>(
    "SELECT id FROM customer WHERE email = $1 AND deleted_at IS NULL AND status = 'active'",
    [normalised],
  );
  if (customer === null) return null;

  const code = generateResetCode();
  await withTransaction(async (tx) => {
    // Any code already outstanding is spent, so requesting a new one invalidates
    // the old rather than leaving several live at once.
    await tx.query(
      `UPDATE customer_password_reset SET consumed_at = now()
        WHERE customer_id = $1 AND consumed_at IS NULL`,
      [customer.id],
    );
    await tx.query(
      `INSERT INTO customer_password_reset (customer_id, code_hash, expires_at, requested_ip)
            VALUES ($1, $2, $3, $4)`,
      [
        customer.id,
        hashResetCode(code),
        new Date(Date.now() + RESET_CODE_TTL_MS),
        context.ip ?? null,
      ],
    );
    await recordAudit(tx, {
      actorType: "customer",
      actorId: customer.id,
      action: "customer.password_reset_requested",
      entityType: "customer",
      entityId: customer.id,
      requestId: context.requestId,
      ip: context.ip,
    });
  });

  return { customerId: customer.id, code };
}

export async function completePasswordReset(
  email: string,
  code: string,
  newPassword: string,
  context: RequestContext = {},
): Promise<void> {
  const normalised = email.trim().toLowerCase();
  await assertWithinRateLimit("customer.password_reset", [
    context.ip,
    rateLimitSubject(normalised),
  ]);

  await assertPasswordNotBreached(newPassword);
  const passwordHash = await hashPassword(newPassword);

  await withTransaction(async (tx) => {
    const rows = await tx.query(
      `SELECT r.id, r.customer_id, r.code_hash, r.attempts
         FROM customer_password_reset r
         JOIN customer c ON c.id = r.customer_id
        WHERE c.email = $1
          AND c.deleted_at IS NULL
          AND r.consumed_at IS NULL
          AND r.expires_at > now()
        ORDER BY r.created_at DESC
        LIMIT 1`,
      [normalised],
    );
    const reset = rows.rows[0] as
      { id: string; customer_id: string; code_hash: string; attempts: number } | undefined;
    if (reset === undefined) throw new InvalidResetCodeError();

    if (reset.attempts >= RESET_MAX_ATTEMPTS) {
      await tx.query("UPDATE customer_password_reset SET consumed_at = now() WHERE id = $1", [
        reset.id,
      ]);
      throw new InvalidResetCodeError();
    }

    const supplied = Buffer.from(hashResetCode(code.trim()));
    const stored = Buffer.from(reset.code_hash);
    const matches = supplied.length === stored.length && timingSafeEqual(supplied, stored);

    if (!matches) {
      await tx.query("UPDATE customer_password_reset SET attempts = attempts + 1 WHERE id = $1", [
        reset.id,
      ]);
      throw new InvalidResetCodeError();
    }

    await tx.query("UPDATE customer_password_reset SET consumed_at = now() WHERE id = $1", [
      reset.id,
    ]);
    await tx.query("UPDATE customer SET password_hash = $2, updated_at = now() WHERE id = $1", [
      reset.customer_id,
      passwordHash,
    ]);

    // Changing a password ends every existing session. Whoever caused the reset
    // must not still be signed in somewhere.
    await revokeAllCustomerSessions(tx, reset.customer_id);

    await recordAudit(tx, {
      actorType: "customer",
      actorId: reset.customer_id,
      action: "customer.password_reset_completed",
      entityType: "customer",
      entityId: reset.customer_id,
      requestId: context.requestId,
      ip: context.ip,
    });
  });
}

export async function suspendCustomer(
  customerId: string,
  reason: string,
  actor: { staffId: string },
): Promise<void> {
  await withTransaction(async (tx) => {
    await tx.query("UPDATE customer SET status = 'suspended', updated_at = now() WHERE id = $1", [
      customerId,
    ]);
    // Suspension revokes access in the same transaction, not on next sign-in.
    await revokeAllCustomerSessions(tx, customerId);
    await recordAudit(tx, {
      actorType: "staff",
      actorId: actor.staffId,
      action: "customer.suspended",
      entityType: "customer",
      entityId: customerId,
      after: { reason },
    });
  });
}

export async function restoreCustomer(
  customerId: string,
  actor: { staffId: string },
): Promise<void> {
  await withTransaction(async (tx) => {
    await tx.query("UPDATE customer SET status = 'active', updated_at = now() WHERE id = $1", [
      customerId,
    ]);
    await recordAudit(tx, {
      actorType: "staff",
      actorId: actor.staffId,
      action: "customer.restored",
      entityType: "customer",
      entityId: customerId,
    });
  });
}

/** Used by the admin's soft-delete, which never removes the row. */
export async function softDeleteCustomer(
  customerId: string,
  reason: string,
  actor: { staffId: string },
): Promise<void> {
  await withTransaction(async (tx) => {
    await tx.query(
      `UPDATE customer
          SET deleted_at = now(), deleted_by = $2, deleted_reason = $3, updated_at = now()
        WHERE id = $1`,
      [customerId, actor.staffId, reason],
    );
    await revokeAllCustomerSessions(tx, customerId);
    await recordAudit(tx, {
      actorType: "staff",
      actorId: actor.staffId,
      action: "customer.deleted",
      entityType: "customer",
      entityId: customerId,
      after: { reason },
    });
  });
}

/** Kept for the rare case where a caller needs the pool rather than a transaction. */
export async function touchCustomerLastSeen(customerId: string): Promise<void> {
  await getPool().query("UPDATE customer SET updated_at = now() WHERE id = $1", [customerId]);
}
