import { query, queryOne } from "../db/client";
import { withTransaction } from "../db/transaction";
import {
  generateRoleCode,
  hashRoleCode,
  normaliseRoleCode,
  roleCodeRejection,
  type StaffRoleCode,
} from "../auth/role-codes";
import { hashPassword } from "../auth/password";
import { recordAudit } from "./audit";
import { assertNotLastCeo } from "./roles";
import { revokeAllStaffSessions } from "../auth/staff-session";
import { syncAdminSearchDocument } from "./admin-search-index";

/**
 * A staff account exists only where a role code was redeemed. Nothing is seeded,
 * no credential comes from the environment, and OAuth cannot create an account —
 * signing in with Google proves control of a mailbox and confers nothing else.
 */

export const DEFAULT_CODE_TTL_MINUTES = 60 * 24 * 7;
export const BOOTSTRAP_CODE_TTL_MINUTES = 15;

export class RoleCodeRejectedError extends Error {
  constructor(readonly reason: "unknown" | "revoked" | "expired" | "exhausted" | "email_mismatch") {
    // Deliberately uniform: telling the caller whether a code exists, or merely
    // expired, tells someone probing which codes are real.
    super("That code cannot be used.");
    this.name = "RoleCodeRejectedError";
  }
}

export class EmailAlreadyRegisteredError extends Error {
  constructor() {
    super("An account already exists for that email address.");
    this.name = "EmailAlreadyRegisteredError";
  }
}

export type MintedCode = { id: string; code: string; role: StaffRoleCode; expiresAt: Date };

/**
 * Returns the plaintext code exactly once — only the hash is stored, so it cannot
 * be recovered afterwards. Lost means mint another.
 */
export async function mintRoleCode(
  {
    role,
    label,
    maxUses = 1,
    ttlMinutes = DEFAULT_CODE_TTL_MINUTES,
  }: { role: StaffRoleCode; label?: string; maxUses?: number; ttlMinutes?: number },
  actor: { staffId: string | null; requestId?: string },
): Promise<MintedCode> {
  const code = generateRoleCode();
  const expiresAt = new Date(Date.now() + ttlMinutes * 60_000);

  return withTransaction(async (tx) => {
    const result = await tx.query(
      `INSERT INTO staff_role_code (code_hash, role_code, label, max_uses, expires_at, created_by)
            VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
      [hashRoleCode(code), role, label ?? null, maxUses, expiresAt, actor.staffId],
    );
    const id = (result.rows[0] as { id: string }).id;

    await recordAudit(tx, {
      actorType: actor.staffId === null ? "system" : "staff",
      actorId: actor.staffId,
      action: "staff_role_code.minted",
      entityType: "staff_role_code",
      entityId: id,
      after: { role, label: label ?? null, maxUses, expiresAt },
      requestId: actor.requestId,
    });

    return { id, code, role, expiresAt };
  });
}

export async function revokeRoleCode(
  codeId: string,
  actor: { staffId: string; requestId?: string },
) {
  return withTransaction(async (tx) => {
    const result = await tx.query(
      `UPDATE staff_role_code
          SET revoked_at = now(), revoked_by = $2
        WHERE id = $1 AND revoked_at IS NULL
      RETURNING role_code`,
      [codeId, actor.staffId],
    );
    if (result.rows.length === 0) return false;
    await recordAudit(tx, {
      actorType: "staff",
      actorId: actor.staffId,
      action: "staff_role_code.revoked",
      entityType: "staff_role_code",
      entityId: codeId,
      requestId: actor.requestId,
    });
    return true;
  });
}

type RedeemInput = {
  code: string;
  email: string;
  fullName: string;
  password?: string;
  googleSubject?: string;
};

/**
 * Redeems a code and creates the staff account it authorises, in one transaction:
 * a code consumed without an account, or an account created from a code that was
 * already spent, are both impossible.
 *
 * `BOOTSTRAP_CEO_EMAIL`, when set, pins who may redeem a CEO code — so a code seen
 * in a terminal or a log is not by itself enough.
 */
export async function redeemRoleCode(
  input: RedeemInput,
  context: { requestId?: string; ip?: string } = {},
): Promise<{ staffId: string; role: StaffRoleCode }> {
  const email = input.email.trim().toLowerCase();
  const codeHash = hashRoleCode(normaliseRoleCode(input.code));
  const passwordHash = input.password ? await hashPassword(input.password) : null;

  return withTransaction(async (tx) => {
    const found = await tx.query(
      `SELECT id, role_code, max_uses, used_count, expires_at, revoked_at
         FROM staff_role_code
        WHERE code_hash = $1`,
      [codeHash],
    );
    const record = found.rows[0] as
      | {
          id: string;
          role_code: StaffRoleCode;
          max_uses: number;
          used_count: number;
          expires_at: Date;
          revoked_at: Date | null;
        }
      | undefined;

    if (record === undefined) throw new RoleCodeRejectedError("unknown");

    const rejection = roleCodeRejection(record);
    if (rejection !== null) throw new RoleCodeRejectedError(rejection);

    const pinned = process.env.BOOTSTRAP_CEO_EMAIL?.trim().toLowerCase();
    if (record.role_code === "CEO" && pinned && pinned !== email) {
      throw new RoleCodeRejectedError("email_mismatch");
    }

    const clash = await tx.query("SELECT id FROM staff WHERE email = $1 AND deleted_at IS NULL", [
      email,
    ]);
    if (clash.rows.length > 0) throw new EmailAlreadyRegisteredError();

    const created = await tx.query(
      `INSERT INTO staff (email, full_name, role_code, password_hash, google_subject, email_verified_at)
            VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
      [
        email,
        input.fullName.trim(),
        record.role_code,
        passwordHash,
        input.googleSubject ?? null,
        // Google already proved the mailbox; a password account verifies by code.
        input.googleSubject ? new Date() : null,
      ],
    );
    const staffId = (created.rows[0] as { id: string }).id;

    // Consuming the code is conditional on the count it was read at, so two
    // simultaneous redemptions of a single-use code cannot both succeed.
    const consumed = await tx.query(
      `UPDATE staff_role_code
          SET used_count = used_count + 1
        WHERE id = $1 AND used_count = $2 AND used_count < max_uses
      RETURNING used_count`,
      [record.id, record.used_count],
    );
    if (consumed.rows.length === 0) throw new RoleCodeRejectedError("exhausted");

    await tx.query(
      `INSERT INTO staff_role_code_redemption (role_code_id, staff_id, request_id)
            VALUES ($1, $2, $3)`,
      [record.id, staffId, context.requestId ?? null],
    );

    await recordAudit(tx, {
      actorType: "system",
      action: "staff.created_by_role_code",
      entityType: "staff",
      entityId: staffId,
      after: { email, role: record.role_code, via: input.googleSubject ? "google" : "password" },
      requestId: context.requestId,
      ip: context.ip,
    });
    await syncAdminSearchDocument(tx, "staff", staffId);

    return { staffId, role: record.role_code };
  });
}

/**
 * Who the access change happened to, so the caller can write to them.
 *
 * The service reports what happened and the adapter decides what to send (ADR
 * 0008 §5) — the email must not fire from in here, because this body runs inside
 * a transaction CockroachDB may retry, and a retried body would send twice.
 */
export type StaffStatusChange =
  { changed: false } | { changed: true; email: string; fullName: string };

export async function setStaffStatus(
  staffId: string,
  status: "active" | "suspended",
  actor: { staffId: string; requestId?: string },
  /**
   * The CEO's own words, to be emailed to the staff member (Q11). Recorded in
   * the audit trail as well as sent, so what was said is part of the permanent
   * record of the access change rather than only in one person's mailbox.
   */
  message?: string | null,
): Promise<StaffStatusChange> {
  return withTransaction(async (tx) => {
    if (status === "suspended") await assertNotLastCeo(tx, staffId);
    const result = await tx.query(
      `UPDATE staff SET status = $2, updated_at = now()
        WHERE id = $1 AND deleted_at IS NULL
    RETURNING status, email, full_name`,
      [staffId, status],
    );
    if (result.rows.length === 0) return { changed: false };
    const changed = result.rows[0] as { email: string; full_name: string };

    // Suspension must end access now, not when a token happens to expire.
    if (status === "suspended") {
      await revokeAllStaffSessions(tx, staffId, "staff suspended");
    }

    await recordAudit(tx, {
      actorType: "staff",
      actorId: actor.staffId,
      action: "staff.status_changed",
      entityType: "staff",
      entityId: staffId,
      after: { status, message: message ?? null },
      requestId: actor.requestId,
    });
    await syncAdminSearchDocument(tx, "staff", staffId);
    return { changed: true, email: changed.email, fullName: changed.full_name };
  });
}

export async function listRoleCodes() {
  return query<{
    id: string;
    role_code: StaffRoleCode;
    label: string | null;
    max_uses: number;
    used_count: number;
    expires_at: Date;
    revoked_at: Date | null;
  }>(
    `SELECT id, role_code, label, max_uses, used_count, expires_at, revoked_at
       FROM staff_role_code
      ORDER BY created_at DESC
      LIMIT 100`,
  );
}

export type AdminStaffMember = {
  id: string;
  email: string;
  fullName: string;
  role: StaffRoleCode;
  status: "active" | "suspended";
  emailVerified: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
};

export async function listStaff(): Promise<AdminStaffMember[]> {
  const rows = await query<{
    id: string;
    email: string;
    full_name: string;
    role_code: StaffRoleCode;
    status: "active" | "suspended";
    email_verified_at: Date | null;
    last_login_at: Date | null;
    created_at: Date;
  }>(
    `SELECT id, email, full_name, role_code, status, email_verified_at, last_login_at, created_at
       FROM staff
      WHERE deleted_at IS NULL
      ORDER BY created_at`,
  );
  return rows.map((row) => ({
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    role: row.role_code,
    status: row.status,
    emailVerified: row.email_verified_at !== null,
    lastLoginAt: row.last_login_at,
    createdAt: row.created_at,
  }));
}

export async function countStaff(): Promise<number> {
  const row = await queryOne<{ total: string }>(
    "SELECT count(*)::STRING AS total FROM staff WHERE deleted_at IS NULL AND status = 'active'",
  );
  return Number(row?.total ?? 0);
}
