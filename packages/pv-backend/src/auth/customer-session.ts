import { createHash, randomBytes } from "node:crypto";
import { query, queryOne, type Queryable } from "../db/client";

/**
 * Customer sessions. A separate table, a separate cookie and a separate code
 * path from staff — AGENTS.md §5's two-identity-stacks rule, kept where it
 * matters most: a privilege bug in the storefront must not be able to reach the
 * admin.
 *
 * The shape mirrors `staff-session.ts` deliberately, but the durations do not.
 * Staff sessions are short because a staff session is authority; a customer
 * session is a shopping convenience, and signing a customer out mid-checkout on
 * Nigerian mobile data is a lost order rather than a security win.
 */

export const CUSTOMER_SESSION_COOKIE = "pv_customer_session";

/** Thirty days absolute, with no idle timeout. A shopper is not a threat model. */
export const CUSTOMER_ABSOLUTE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const TOKEN_BYTES = 32;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export type CustomerPrincipal = {
  sessionId: string;
  customerId: string;
  email: string;
  fullName: string | null;
  phone: string | null;
};

export async function issueCustomerSession(
  customerId: string,
  tx?: Queryable,
): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(TOKEN_BYTES).toString("base64url");
  const expiresAt = new Date(Date.now() + CUSTOMER_ABSOLUTE_TTL_MS);
  const sql = `INSERT INTO customer_session (customer_id, token_hash, absolute_expires_at)
                    VALUES ($1, $2, $3)`;
  const parameters = [customerId, hashToken(token), expiresAt];
  if (tx) await tx.query(sql, parameters);
  else await query(sql, parameters);
  return { token, expiresAt };
}

type CustomerSessionRow = {
  session_id: string;
  customer_id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  status: string;
  deleted_at: Date | null;
  absolute_expires_at: Date;
  revoked_at: Date | null;
};

/**
 * Verifies a session token. Like the staff equivalent, the row is found by the
 * hash of the token rather than by comparing candidates, so this is one indexed
 * read — and the database never holds a working token, only its digest.
 *
 * `last_seen_at` is deliberately not touched on every read. Staff sessions need
 * it for the idle timeout; customer sessions have no idle timeout, so writing on
 * every page view would be a write amplification with no purpose.
 */
export async function verifyCustomerSession(token: string): Promise<CustomerPrincipal | null> {
  const row = await queryOne<CustomerSessionRow>(
    `SELECT s.id AS session_id, s.customer_id, s.absolute_expires_at, s.revoked_at,
            c.email, c.full_name, c.phone, c.status, c.deleted_at
       FROM customer_session s
       JOIN customer c ON c.id = s.customer_id
      WHERE s.token_hash = $1`,
    [hashToken(token)],
  );
  if (row === null) return null;
  if (row.revoked_at !== null) return null;
  if (row.deleted_at !== null || row.status !== "active") return null;
  if (row.absolute_expires_at.getTime() <= Date.now()) return null;

  return {
    sessionId: row.session_id,
    customerId: row.customer_id,
    email: row.email,
    fullName: row.full_name,
    phone: row.phone,
  };
}

export async function revokeCustomerSession(token: string): Promise<void> {
  await query("UPDATE customer_session SET revoked_at = now() WHERE token_hash = $1", [
    hashToken(token),
  ]);
}

/**
 * Used when a password changes and when an account is suspended. §5 requires the
 * session id to rotate on a privilege change; for a customer the equivalent is
 * that changing a password ends every other session, which is what a person
 * expects "sign out everywhere" to mean.
 */
export async function revokeAllCustomerSessions(
  tx: Queryable,
  customerId: string,
  { except }: { except?: string } = {},
): Promise<void> {
  if (except === undefined) {
    await tx.query(
      "UPDATE customer_session SET revoked_at = now() WHERE customer_id = $1 AND revoked_at IS NULL",
      [customerId],
    );
    return;
  }
  await tx.query(
    `UPDATE customer_session
        SET revoked_at = now()
      WHERE customer_id = $1 AND revoked_at IS NULL AND id <> $2`,
    [customerId, except],
  );
}
