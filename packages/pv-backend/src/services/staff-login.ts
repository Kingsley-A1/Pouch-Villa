import { createRemoteJWKSet, jwtVerify } from "jose";
import { getPool, queryOne } from "../db/client";
import { withTransaction } from "../db/transaction";
import { verifyPassword } from "../auth/password";
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

  const valid =
    staff !== null && staff.password_hash !== null && verifyPassword(password, staff.password_hash);

  if (!valid) {
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
    return { staffId: staff.id, role: staff.role_code };
  });
}

let googleJwks: ReturnType<typeof createRemoteJWKSet> | null = null;
function jwks() {
  googleJwks ??= createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));
  return googleJwks;
}

/**
 * Verifies a Google Identity Services credential (an ID token JWT) against
 * Google's own published keys — no server-side redirect flow is needed for the
 * "Sign in with Google" button, which hands the browser a signed token directly.
 */
export async function verifyGoogleIdToken(idToken: string) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) throw new Error("GOOGLE_CLIENT_ID is not configured.");
  const { payload } = await jwtVerify(idToken, jwks(), {
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    audience: clientId,
  });
  const subject = payload.sub;
  const email = typeof payload.email === "string" ? payload.email.toLowerCase() : null;
  const emailVerified = payload.email_verified === true;
  if (!subject || !email) throw new Error("Google did not return an email address.");
  return { subject, email, emailVerified };
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
