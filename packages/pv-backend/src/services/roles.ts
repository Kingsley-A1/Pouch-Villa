import { query, type Queryable } from "../db/client";
import { withTransaction } from "../db/transaction";
import { isCeoOnly, type PermissionCode } from "../auth/permission-codes";
import type { StaffRoleCode } from "../auth/role-codes";
import { recordAudit } from "./audit";

/**
 * Roles and grants are rows, not a compile-time map, because the scope says the
 * CEO controls what managers and employees may do — and a constant cannot be
 * edited by a person on a Sunday.
 *
 * Three invariants are enforced here rather than in the UI, because the UI is not
 * a security boundary:
 *
 *   1. The CEO role cannot be edited, by anyone, including a CEO.
 *   2. `role.manage` and `staff.manage` cannot be granted to any other role —
 *      either one is a path to full control.
 *   3. The last active CEO cannot be demoted, suspended or deleted.
 */

export class RoleProtectedError extends Error {
  constructor(role: string) {
    super(`The ${role} role cannot be modified.`);
    this.name = "RoleProtectedError";
  }
}

export class PermissionNotDelegableError extends Error {
  constructor(permission: string) {
    super(`${permission} cannot be granted to any role other than CEO.`);
    this.name = "PermissionNotDelegableError";
  }
}

export class LastCeoError extends Error {
  constructor() {
    super("The last remaining CEO cannot be demoted, suspended or removed.");
    this.name = "LastCeoError";
  }
}

export async function permissionsForRole(role: StaffRoleCode): Promise<PermissionCode[]> {
  const rows = await query<{ permission_code: PermissionCode }>(
    "SELECT permission_code FROM role_permission WHERE role_code = $1 ORDER BY permission_code",
    [role],
  );
  return rows.map((row) => row.permission_code);
}

/** Authority is always re-derived from the database, never trusted from a session. */
export async function staffHasPermission(
  staffId: string,
  permission: PermissionCode,
): Promise<boolean> {
  const rows = await query<{ ok: boolean }>(
    `SELECT true AS ok
       FROM staff s
       JOIN role_permission rp ON rp.role_code = s.role_code
      WHERE s.id = $1
        AND s.deleted_at IS NULL
        AND s.status = 'active'
        AND rp.permission_code = $2
      LIMIT 1`,
    [staffId, permission],
  );
  return rows.length > 0;
}

async function assertNotProtected(tx: Queryable, role: StaffRoleCode) {
  const result = await tx.query("SELECT is_protected FROM staff_role WHERE code = $1", [role]);
  const row = result.rows[0] as { is_protected: boolean } | undefined;
  if (row === undefined) throw new Error(`Unknown role ${role}.`);
  if (row.is_protected) throw new RoleProtectedError(role);
}

export async function setRolePermissions(
  actorStaffId: string,
  role: StaffRoleCode,
  permissions: readonly PermissionCode[],
  requestId?: string,
) {
  for (const permission of permissions) {
    if (isCeoOnly(permission)) throw new PermissionNotDelegableError(permission);
  }

  return withTransaction(async (tx) => {
    await assertNotProtected(tx, role);

    const before = await tx.query(
      "SELECT permission_code FROM role_permission WHERE role_code = $1 ORDER BY permission_code",
      [role],
    );

    await tx.query("DELETE FROM role_permission WHERE role_code = $1", [role]);
    if (permissions.length > 0) {
      await tx.query(
        `INSERT INTO role_permission (role_code, permission_code, granted_by)
         SELECT $1, unnest($2::STRING[]), $3`,
        [role, permissions, actorStaffId],
      );
    }

    await recordAudit(tx, {
      actorType: "staff",
      actorId: actorStaffId,
      action: "role.permissions_changed",
      entityType: "staff_role",
      entityId: role,
      before: {
        permissions: before.rows.map((r) => (r as { permission_code: string }).permission_code),
      },
      after: { permissions: [...permissions] },
      requestId,
    });

    return permissions.length;
  });
}

async function countOtherActiveCeos(tx: Queryable, excludingStaffId: string): Promise<number> {
  const result = await tx.query(
    `SELECT count(*)::INT AS total
       FROM staff
      WHERE role_code = 'CEO'
        AND status = 'active'
        AND deleted_at IS NULL
        AND id <> $1`,
    [excludingStaffId],
  );
  return (result.rows[0] as { total: number }).total;
}

/**
 * Guards every path that could remove the last CEO — demotion, suspension and
 * soft-delete alike. Locking is unnecessary: CockroachDB's serializable isolation
 * aborts one of two concurrent transactions that both read this count, and the
 * retry re-reads it.
 */
export async function assertNotLastCeo(tx: Queryable, staffId: string) {
  const target = await tx.query(
    "SELECT role_code FROM staff WHERE id = $1 AND deleted_at IS NULL",
    [staffId],
  );
  const row = target.rows[0] as { role_code: string } | undefined;
  if (row === undefined || row.role_code !== "CEO") return;
  if ((await countOtherActiveCeos(tx, staffId)) === 0) throw new LastCeoError();
}
