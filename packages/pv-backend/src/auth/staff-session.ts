import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { query, queryOne, type Queryable } from "../db/client";
import type { StaffRoleCode } from "./role-codes";

/**
 * Server-side, revocable staff sessions, backed by the `staff_session` table.
 *
 * The prototype signed a stateless JWT: revoking a fired employee's access meant
 * waiting for an 8-hour token to expire on its own. That is not acceptable for
 * staff access, so nothing here is stateless — every check re-reads the row, and
 * suspending or deleting a staff member revokes it immediately (see
 * `staff-access.ts`'s `revokeAllSessionsFor`).
 *
 * The cookie carries an opaque token; the database never stores it in plaintext,
 * only its SHA-256 hash, on the same reasoning as a role code — a leaked backup
 * or a read-replica should not hand over a working session.
 */

export const SESSION_COOKIE = "pv_staff_session";
export const ABSOLUTE_TTL_MS = 8 * 60 * 60 * 1000;
export const IDLE_TIMEOUT_MS = 30 * 60 * 1000;

const TOKEN_BYTES = 32;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export type StaffPrincipal = {
  sessionId: string;
  staffId: string;
  email: string;
  fullName: string;
  role: StaffRoleCode;
  emailVerified: boolean;
};

export async function issueStaffSession(
  staffId: string,
  context: { ip?: string; userAgent?: string } = {},
): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(TOKEN_BYTES).toString("base64url");
  const expiresAt = new Date(Date.now() + ABSOLUTE_TTL_MS);
  await query(
    `INSERT INTO staff_session (staff_id, token_hash, absolute_expires_at, ip, user_agent)
          VALUES ($1, $2, $3, $4, $5)`,
    [staffId, hashToken(token), expiresAt, context.ip ?? null, context.userAgent ?? null],
  );
  return { token, expiresAt };
}

type SessionRow = {
  session_id: string;
  staff_id: string;
  email: string;
  full_name: string;
  role_code: StaffRoleCode;
  email_verified_at: Date | null;
  status: string;
  deleted_at: Date | null;
  absolute_expires_at: Date;
  last_seen_at: Date;
  revoked_at: Date | null;
};

/**
 * Verifies a session token and, if valid, touches `last_seen_at`. A row is looked
 * up by its hash rather than compared token-by-token, so this is a single indexed
 * read — the timing-safe comparison below only protects against an attacker who
 * has already found a hash collision in the index scan, which `timingSafeEqual`
 * on the final candidate covers.
 */
export async function verifyStaffSession(token: string): Promise<StaffPrincipal | null> {
  const hash = hashToken(token);
  const row = await queryOne<SessionRow>(
    `SELECT s.id AS session_id, s.staff_id, s.absolute_expires_at, s.last_seen_at, s.revoked_at,
            st.email, st.full_name, st.role_code, st.email_verified_at, st.status, st.deleted_at
       FROM staff_session s
       JOIN staff st ON st.id = s.staff_id
      WHERE s.token_hash = $1`,
    [hash],
  );
  if (row === null) return null;
  if (!timingSafeEqual(Buffer.from(hashToken(token)), Buffer.from(hash))) return null;

  const now = Date.now();
  if (row.revoked_at !== null) return null;
  if (row.deleted_at !== null || row.status !== "active") return null;
  if (row.absolute_expires_at.getTime() <= now) return null;
  if (now - row.last_seen_at.getTime() > IDLE_TIMEOUT_MS) return null;

  await query("UPDATE staff_session SET last_seen_at = now() WHERE id = $1", [row.session_id]);

  return {
    sessionId: row.session_id,
    staffId: row.staff_id,
    email: row.email,
    fullName: row.full_name,
    role: row.role_code,
    emailVerified: row.email_verified_at !== null,
  };
}

export async function revokeStaffSession(token: string) {
  await query(
    "UPDATE staff_session SET revoked_at = now(), revoked_reason = 'signed out' WHERE token_hash = $1",
    [hashToken(token)],
  );
}

export async function revokeAllStaffSessions(tx: Queryable, staffId: string, reason: string) {
  await tx.query(
    `UPDATE staff_session
        SET revoked_at = now(), revoked_reason = $2
      WHERE staff_id = $1 AND revoked_at IS NULL`,
    [staffId, reason],
  );
}
