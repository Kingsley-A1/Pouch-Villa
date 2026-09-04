import { queryOne } from "../db/client";
import { withTransaction } from "../db/transaction";
import { assertPasswordLength, hashPassword, verifyPassword } from "../auth/password";
import { assertPasswordNotBreached } from "../auth/breach-check";
import { revokeAllStaffSessions } from "../auth/staff-session";
import { normalisePhone } from "../domain/phone";
import type { StaffRoleCode } from "../auth/role-codes";
import { recordAudit } from "./audit";
import { syncAdminSearchDocument } from "./admin-search-index";

/**
 * A staff member's own account, edited by the person it belongs to.
 *
 * The admin had every screen for managing *other* people and none for managing
 * yourself: a mistyped name needed somebody with `staff.manage` to correct it,
 * and there was nowhere at all to change your own password. This is the
 * customer's "Your details" screen, for the other identity stack.
 *
 * **Every function here is scoped to a staff id taken from the session**, never
 * from a request parameter, so no shape of input reaches another person's
 * account. That is what lets these run with no permission check beyond being
 * signed in — editing your own name is not an act of authority, and requiring
 * `staff.manage` for it would mean an Employee could not correct their own
 * spelling while a Manager could rewrite everyone's.
 *
 * Three things are deliberately **not** editable here, and each one is a
 * privilege boundary rather than an omission:
 *
 *   - **Role.** Raising your own role is the whole attack. Roles change only by
 *     redeeming a code or by a CEO's act, per ADR 0002.
 *   - **Email.** It is the account's identity and where a verification lands.
 *     Changing it is an account-takeover step and needs a flow that proves
 *     control of the new address first — the same reasoning as the customer's.
 *   - **Status.** Nobody un-suspends themselves.
 */

export type StaffProfile = {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  role: StaffRoleCode;
  emailVerified: boolean;
  /** Whether a password is set at all. A Google-only account has none. */
  hasPassword: boolean;
  hasGoogle: boolean;
  memberSince: Date;
  lastLoginAt: Date | null;
};

export class StaffNotFoundError extends Error {
  constructor() {
    super("That account could not be found.");
    this.name = "StaffNotFoundError";
  }
}

export class IncorrectCurrentPasswordError extends Error {
  constructor() {
    super("That is not your current password.");
    this.name = "IncorrectCurrentPasswordError";
  }
}

export async function getStaffProfile(staffId: string): Promise<StaffProfile | null> {
  const row = await queryOne<{
    id: string;
    email: string;
    full_name: string;
    phone: string | null;
    role_code: StaffRoleCode;
    email_verified_at: Date | null;
    password_hash: string | null;
    google_subject: string | null;
    created_at: Date;
    last_login_at: Date | null;
  }>(
    `SELECT id, email, full_name, phone, role_code, email_verified_at,
            password_hash, google_subject, created_at, last_login_at
       FROM staff WHERE id = $1 AND deleted_at IS NULL`,
    [staffId],
  );
  if (row === null) return null;

  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    phone: row.phone,
    role: row.role_code,
    emailVerified: row.email_verified_at !== null,
    // The hash itself never leaves this function — only whether one exists.
    hasPassword: row.password_hash !== null,
    hasGoogle: row.google_subject !== null,
    memberSince: row.created_at,
    lastLoginAt: row.last_login_at,
  };
}

export type StaffProfileUpdate = { fullName: string; phone: string | null };

export async function updateStaffProfile(
  staffId: string,
  update: StaffProfileUpdate,
  context: { ip?: string | undefined; requestId?: string | undefined } = {},
): Promise<void> {
  const fullName = update.fullName.trim();
  if (fullName === "") throw new StaffNotFoundError();
  const typedPhone = update.phone?.trim() || null;
  const phone = typedPhone === null ? null : normalisePhone(typedPhone);

  await withTransaction(async (tx) => {
    const before = await tx.query(
      "SELECT full_name, phone FROM staff WHERE id = $1 AND deleted_at IS NULL",
      [staffId],
    );
    if (before.rows.length === 0) throw new StaffNotFoundError();

    await tx.query(
      `UPDATE staff
          SET full_name = $2, phone = $3, phone_normalised = $4, updated_at = now()
        WHERE id = $1`,
      [staffId, fullName, typedPhone, phone],
    );
    // §5: every privileged mutation is audited, and a staff member editing their
    // own row is no exception — it is how a changed name is explained later.
    await recordAudit(tx, {
      actorType: "staff",
      actorId: staffId,
      action: "staff.profile_updated",
      entityType: "staff",
      entityId: staffId,
      before: before.rows[0],
      after: { full_name: fullName, phone: typedPhone },
      requestId: context.requestId,
      ip: context.ip,
    });
    await syncAdminSearchDocument(tx, "staff", staffId);
  });
}

/**
 * Changes a password from inside the account.
 *
 * The current password is required even though the session already proves who
 * this is: a session left open on a shop counter should not be enough to lock
 * its owner out. An account that only ever signed in with Google has no current
 * password, so it sets one — which is what gives a staff member a second way in
 * if Google is unreachable.
 */
export async function changeStaffPassword(
  staffId: string,
  currentPassword: string | null,
  newPassword: string,
  context: { ip?: string | undefined; requestId?: string | undefined } = {},
): Promise<void> {
  const row = await queryOne<{ password_hash: string | null }>(
    "SELECT password_hash FROM staff WHERE id = $1 AND deleted_at IS NULL",
    [staffId],
  );
  if (row === null) throw new StaffNotFoundError();

  if (row.password_hash !== null) {
    const matches =
      currentPassword !== null && (await verifyPassword(currentPassword, row.password_hash));
    if (!matches) throw new IncorrectCurrentPasswordError();
  }

  assertPasswordLength(newPassword);
  // Both are slow and neither touches the database, so they happen before the
  // transaction opens rather than inside a body the server may retry.
  await assertPasswordNotBreached(newPassword);
  const passwordHash = await hashPassword(newPassword);

  await withTransaction(async (tx) => {
    await tx.query("UPDATE staff SET password_hash = $2, updated_at = now() WHERE id = $1", [
      staffId,
      passwordHash,
    ]);
    // Every other session ends. A password change is what someone does when they
    // think an account is compromised, and leaving the intruder's session alive
    // would make the act pointless. §5 requires staff access to be revocable
    // immediately, and this is that mechanism used on your own behalf.
    await revokeAllStaffSessions(tx, staffId, "password changed");
    await recordAudit(tx, {
      actorType: "staff",
      actorId: staffId,
      action: "staff.password_changed",
      entityType: "staff",
      entityId: staffId,
      requestId: context.requestId,
      ip: context.ip,
    });
  });
}
