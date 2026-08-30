import { afterAll, afterEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { writableTestDatabaseConfigured } from "./helpers/database";
import type { StaffRoleCode } from "../src/auth/role-codes";
import { closePool, query } from "../src/db/client";
import {
  EmailAlreadyRegisteredError,
  RoleCodeRejectedError,
  mintRoleCode,
  redeemRoleCode,
  revokeRoleCode,
  setStaffStatus,
} from "../src/services/staff-access";
import {
  setRolePermissions,
  PermissionNotDelegableError,
  RoleProtectedError,
} from "../src/services/roles";
import { permissionsForRole, staffHasPermission } from "../src/services/roles";

/**
 * Integration against a real CockroachDB, because the retry semantics and the
 * conditional-update concurrency guards are the point — a mock would assert
 * nothing about either.
 */

// These tests create and delete rows, so they run only against a database that is
// explicitly nominated for testing — never whatever DATABASE_URL happens to hold.
const describeDb = writableTestDatabaseConfigured() ? describe : describe.skip;

/**
 * The deployment pins who may redeem a CEO code. These tests exercise the role
 * mechanics rather than that pin, so it is lifted here and covered by its own test
 * below — otherwise every CEO redemption would fail on a mismatched test address.
 */
delete process.env.BOOTSTRAP_CEO_EMAIL;

const created: { staff: string[]; codes: string[] } = { staff: [], codes: [] };

function testEmail() {
  return `zz-test-${randomUUID()}@pv-integration.invalid`;
}

async function mint(
  role: StaffRoleCode,
  options: { maxUses?: number; ttlMinutes?: number; label?: string } = {},
) {
  const minted = await mintRoleCode({ role, ...options }, { staffId: null });
  created.codes.push(minted.id);
  return minted;
}

async function redeem(code: string, email = testEmail()) {
  const result = await redeemRoleCode({
    code,
    email,
    fullName: "Integration Test",
    password: "correct-horse-battery",
  });
  created.staff.push(result.staffId);
  return { ...result, email };
}

/**
 * Codes reference the staff who created or revoked them, so those links are
 * cleared before the staff rows go. Audit records are append-only by design and
 * are removed by the individual tests that assert on them.
 */
async function cleanUp() {
  if (created.staff.length > 0) {
    await query("DELETE FROM staff_role_code_redemption WHERE staff_id = ANY($1)", [created.staff]);
    await query("DELETE FROM staff_session WHERE staff_id = ANY($1)", [created.staff]);
    await query("UPDATE staff_role_code SET created_by = NULL WHERE created_by = ANY($1)", [
      created.staff,
    ]);
    await query("UPDATE staff_role_code SET revoked_by = NULL WHERE revoked_by = ANY($1)", [
      created.staff,
    ]);
  }
  if (created.codes.length > 0) {
    await query("DELETE FROM staff_role_code_redemption WHERE role_code_id = ANY($1)", [
      created.codes,
    ]);
    await query("DELETE FROM staff_role_code WHERE id = ANY($1)", [created.codes]);
    created.codes.length = 0;
  }
  if (created.staff.length > 0) {
    await query("DELETE FROM audit_event WHERE actor_id = ANY($1)", [created.staff]);
    await query("DELETE FROM staff WHERE id = ANY($1)", [created.staff]);
    created.staff.length = 0;
  }
}

describeDb("staff access via role codes", () => {
  afterEach(cleanUp);

  it("creates an account carrying the role the code granted", async () => {
    const minted = await mint("MANAGER");
    const { staffId, role } = await redeem(minted.code);

    expect(role).toBe("MANAGER");
    const rows = await query<{ role_code: string; status: string }>(
      "SELECT role_code, status FROM staff WHERE id = $1",
      [staffId],
    );
    expect(rows[0]?.role_code).toBe("MANAGER");
    expect(rows[0]?.status).toBe("active");
  });

  it("accepts the code as displayed, with its grouping dashes", async () => {
    const minted = await mint("EMPLOYEE");
    const grouped = minted.code.replace(/(.{4})/, "$1-");
    await expect(redeem(grouped)).resolves.toMatchObject({ role: "EMPLOYEE" });
  });

  it("consumes a single-use code so it cannot be redeemed twice", async () => {
    const minted = await mint("EMPLOYEE");
    await redeem(minted.code);
    await expect(redeem(minted.code)).rejects.toBeInstanceOf(RoleCodeRejectedError);
  });

  it("honours a multi-use code up to its limit and no further", async () => {
    const minted = await mint("EMPLOYEE", { maxUses: 2 });
    await redeem(minted.code);
    await redeem(minted.code);
    await expect(redeem(minted.code)).rejects.toBeInstanceOf(RoleCodeRejectedError);
  });

  it("refuses a revoked code immediately", async () => {
    const minted = await mint("MANAGER");
    const ceo = await mint("CEO");
    const ceoStaff = await redeem(ceo.code);
    await revokeRoleCode(minted.id, { staffId: ceoStaff.staffId });
    await expect(redeem(minted.code)).rejects.toBeInstanceOf(RoleCodeRejectedError);
  });

  it("refuses an expired code", async () => {
    const minted = await mint("EMPLOYEE", { ttlMinutes: -1 });
    await expect(redeem(minted.code)).rejects.toBeInstanceOf(RoleCodeRejectedError);
  });

  it("refuses a code that was never issued", async () => {
    await expect(redeem("ZZZZ9999")).rejects.toBeInstanceOf(RoleCodeRejectedError);
  });

  it("refuses a second account on the same email", async () => {
    const first = await mint("EMPLOYEE");
    const second = await mint("EMPLOYEE");
    const { email } = await redeem(first.code);
    await expect(redeem(second.code, email)).rejects.toBeInstanceOf(EmailAlreadyRegisteredError);
  });

  it("never stores the plaintext code", async () => {
    const minted = await mint("EMPLOYEE");
    const rows = await query<{ code_hash: string }>(
      "SELECT code_hash FROM staff_role_code WHERE id = $1",
      [minted.id],
    );
    expect(rows[0]?.code_hash).not.toContain(minted.code);
    expect(rows[0]?.code_hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("refuses a CEO code redeemed by an address other than the pinned one", async () => {
    const pinned = testEmail();
    process.env.BOOTSTRAP_CEO_EMAIL = pinned;
    try {
      const minted = await mint("CEO");
      // A code seen in a terminal or a log is not, by itself, enough.
      await expect(redeem(minted.code, testEmail())).rejects.toBeInstanceOf(RoleCodeRejectedError);
      // The rejection must not have consumed the code.
      await expect(redeem(minted.code, pinned)).resolves.toMatchObject({ role: "CEO" });
    } finally {
      delete process.env.BOOTSTRAP_CEO_EMAIL;
    }
  });

  it("writes an audit record for the mint and the account it created", async () => {
    const minted = await mint("MANAGER");
    const { staffId } = await redeem(minted.code);
    const events = await query<{ action: string }>(
      "SELECT action FROM audit_event WHERE entity_id IN ($1, $2) ORDER BY occurred_at",
      [minted.id, staffId],
    );
    expect(events.map((e) => e.action)).toEqual([
      "staff_role_code.minted",
      "staff.created_by_role_code",
    ]);
    await query("DELETE FROM audit_event WHERE entity_id IN ($1, $2)", [minted.id, staffId]);
  });
});

describeDb("runtime permission changes", () => {
  afterEach(cleanUp);

  afterAll(closePool);

  it("refuses to edit the protected CEO role", async () => {
    const ceo = await mint("CEO");
    const actor = await redeem(ceo.code);
    await expect(
      setRolePermissions(actor.staffId, "CEO", ["dashboard.view"]),
    ).rejects.toBeInstanceOf(RoleProtectedError);
  });

  it("refuses to delegate a permission that confers full control", async () => {
    const ceo = await mint("CEO");
    const actor = await redeem(ceo.code);
    await expect(
      setRolePermissions(actor.staffId, "MANAGER", ["dashboard.view", "role.manage"]),
    ).rejects.toBeInstanceOf(PermissionNotDelegableError);
  });

  it("takes effect for a signed-in staff member without a deploy", async () => {
    const ceo = await mint("CEO");
    const actor = await redeem(ceo.code);
    const employeeCode = await mint("EMPLOYEE");
    const employee = await redeem(employeeCode.code);

    expect(await staffHasPermission(employee.staffId, "delivery.manage")).toBe(false);

    const original = await permissionsForRole("EMPLOYEE");
    try {
      await setRolePermissions(actor.staffId, "EMPLOYEE", [...original, "delivery.manage"]);
      expect(await staffHasPermission(employee.staffId, "delivery.manage")).toBe(true);
    } finally {
      await setRolePermissions(actor.staffId, "EMPLOYEE", original);
    }
    expect(await staffHasPermission(employee.staffId, "delivery.manage")).toBe(false);
    await query("DELETE FROM audit_event WHERE entity_id = 'EMPLOYEE'");
  });

  it("stops authorising a suspended staff member at once", async () => {
    const ceo = await mint("CEO");
    const actor = await redeem(ceo.code);
    const managerCode = await mint("MANAGER");
    const manager = await redeem(managerCode.code);

    expect(await staffHasPermission(manager.staffId, "order.manage")).toBe(true);
    await setStaffStatus(manager.staffId, "suspended", { staffId: actor.staffId });
    expect(await staffHasPermission(manager.staffId, "order.manage")).toBe(false);
    await query("DELETE FROM audit_event WHERE entity_id = $1", [manager.staffId]);
  });
});
