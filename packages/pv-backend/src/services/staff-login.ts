import { verifyGoogleIdToken } from "../auth/google";
import { getPool, queryOne } from "../db/client";
import { withTransaction } from "../db/transaction";
import { hashPassword, needsRehash, verifyPassword } from "../auth/password";
import { revokeStaffSession, type StaffPrincipal } from "../auth/staff-session";
import { recordAudit } from "./audit";

/**
 * Staff sign-in: email + password, or Google. Per ADR 0002, Google authenticates
 * only — it can sign in an *existing* staff account (matched by its stored
 * `google_subject`, or by email on first use) but it can never create one. An
 * account exists only where a role code was redeemed.
 *
 * These functions verify identity and record it; they deliberately do not issue a
 * session. Session issuance sets a cookie, which is a Next.js concern — the
 * frontend adapter calls `createStaffSession(staffId)` exactly once, after
 * whichever of these two confirms who is signing in.
 */

export type AuthenticatedStaff = { staffId: string; role: StaffPrincipal["role"] };

export class InvalidCredentialsError extends Error {
  constructor() {
    super("That email or password is incorrect.");
    this.name = "InvalidCredentialsError";
  }
}

export class TooManyAttemptsError extends Error {
  constructor() {
    super("Too many attempts. Try again in a few minutes.");
    this.name = "TooManyAttemptsError";
  }
}

export class AccountNotLinkedError extends Error {
  constructor() {
    super("No staff account is linked to that Google account.");
    this.name = "AccountNotLinkedError";
  }
}

export class AccountSuspendedError extends Error {
  constructor() {
    super("This account has been suspended.");
    this.name = "AccountSuspendedError";
  }
}

const RATE_LIMIT_WINDOW_MINUTES = 15;
const RATE_LIMIT_MAX_ATTEMPTS = 5;

/**
 * A read against the existing audit trail rather than a new table. It is
 * per-email, which also rate-limits an attacker who only knows the address —
 * not just one who already controls an account.
 */
async function assertNotRateLimited(email: string) {
  const row = await queryOne<{ total: string }>(
    `SELECT count(*)::STRING AS total
       FROM audit_event
      WHERE action = 'staff.login_failed'
        AND entity_id = $1
        AND occurred_at > now() - interval '${RATE_LIMIT_WINDOW_MINUTES} minutes'`,
    [email],
  );
  if (Number(row?.total ?? 0) >= RATE_LIMIT_MAX_ATTEMPTS) throw new TooManyAttemptsError();
}

type StaffAuthRow = {
  id: string;
  email: string;
  full_name: string;
  role_code: StaffPrincipal["role"];
  password_hash: string | null;
  google_subject: string | null;
  status: string;
};

export async function loginWithPassword(
  email: string,
  password: string,
  context: { ip?: string; userAgent?: string; requestId?: string } = {},
): Promise<AuthenticatedStaff> {
  const normalised = email.trim().toLowerCase();
  await assertNotRateLimited(normalised);

  const staff = await queryOne<StaffAuthRow>(
    `SELECT id, email, full_name, role_code, password_hash, google_subject, status
       FROM staff WHERE email = $1 AND deleted_at IS NULL`,
    [normalised],
  );

  /**
   * An account that only ever signs in with Google has no password hash, so a
   * password attempt against it fails exactly as a wrong password does — the
   * caller must not be able to tell the two apart, or the response becomes an
   * oracle for which accounts exist and how they authenticate.
   */
  const storedHash = staff?.password_hash ?? null;

  if (staff === null || storedHash === null || !(await verifyPassword(password, storedHash))) {
    await recordAudit(getPool(), {
      actorType: "system",
      action: "staff.login_failed",
      entityType: "staff_login",
      entityId: normalised,
      requestId: context.requestId,
      ip: context.ip,
    });
    throw new InvalidCredentialsError();
  }
  if (staff.status !== "active") throw new AccountSuspendedError();

  /**
   * ADR 0004: a hash left over from bcrypt is upgraded to Argon2id the next time
   * its owner signs in successfully — no forced reset, and nobody notices.
   *
   * Computed here rather than inside the transaction below, because hashing
   * costs ~190ms of CPU and the transaction body is re-executed from the start
   * on a CockroachDB retry. Short transactions, no wasted work.
   */
  const upgradedHash = needsRehash(storedHash) ? await hashPassword(password) : null;

  return withTransaction(async (transaction) => {
    await recordAudit(transaction, {
      actorType: "staff",
      actorId: staff.id,
      action: "staff.login_succeeded",
      entityType: "staff",
      entityId: staff.id,
      requestId: context.requestId,
      ip: context.ip,
    });
    await transaction.query("UPDATE staff SET last_login_at = now() WHERE id = $1", [staff.id]);
    if (upgradedHash !== null) {
      await transaction.query("UPDATE staff SET password_hash = $2 WHERE id = $1", [
        staff.id,
        upgradedHash,
      ]);
    }
    return { staffId: staff.id, role: staff.role_code };
  });
}

export async function loginWithGoogle(
  idToken: string,
  context: { ip?: string; userAgent?: string; requestId?: string } = {},
): Promise<AuthenticatedStaff> {
  const { subject, email, emailVerified } = await verifyGoogleIdToken(idToken);

  return withTransaction(async (transaction) => {
    const byGoogle = await transaction.query(
      `SELECT id, role_code, status FROM staff WHERE google_subject = $1 AND deleted_at IS NULL`,
      [subject],
    );
    let row = byGoogle.rows[0] as
      { id: string; role_code: StaffPrincipal["role"]; status: string } | undefined;

    if (row === undefined) {
      // First Google sign-in for an account that was created with a password:
      // link it by email, but only if Google itself has verified that mailbox.
      if (!emailVerified) throw new AccountNotLinkedError();
      const byEmail = await transaction.query(
        `UPDATE staff SET google_subject = $1, email_verified_at = coalesce(email_verified_at, now())
              WHERE email = $2 AND deleted_at IS NULL AND google_subject IS NULL
          RETURNING id, role_code, status`,
        [subject, email],
      );
      row = byEmail.rows[0] as
        { id: string; role_code: StaffPrincipal["role"]; status: string } | undefined;
    }

    if (row === undefined) throw new AccountNotLinkedError();
    if (row.status !== "active") throw new AccountSuspendedError();

    await recordAudit(transaction, {
      actorType: "staff",
      actorId: row.id,
      action: "staff.login_succeeded",
      entityType: "staff",
      entityId: row.id,
      after: { via: "google" },
      requestId: context.requestId,
      ip: context.ip,
    });
    await transaction.query("UPDATE staff SET last_login_at = now() WHERE id = $1", [row.id]);
    return { staffId: row.id, role: row.role_code };
  });
}

export async function logout(token: string) {
  await revokeStaffSession(token);
}
