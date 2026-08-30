import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { resolve } from "node:path";
import { loadEnvFiles } from "../src/env";
import { closePool, query } from "../src/db/client";
import {
  PERMISSIONS,
  CEO_ONLY_PERMISSIONS,
  type PermissionCode,
} from "../src/auth/permission-codes";
import { STAFF_ROLES, type StaffRoleCode } from "../src/auth/role-codes";

/**
 * The test that keeps the client's business safe: for every role and every
 * permission, assert allowed *and* denied against the real grants in the database.
 *
 * Requires DATABASE_URL. It reads only — no fixture is written — so it is safe to
 * run against any environment whose grants you want to confirm.
 */

loadEnvFiles(resolve(process.cwd(), "../.."));
loadEnvFiles(process.cwd());

const configured = Boolean(process.env.DATABASE_URL?.trim());
const describeDb = configured ? describe : describe.skip;

/** The intended matrix, written out in full rather than derived from the migration. */
const EMPLOYEE_ALLOWED: readonly PermissionCode[] = [
  "dashboard.view",
  "product.view",
  "order.view",
  "order.manage",
  "payment.view",
  "customer.view",
  "enquiry.manage",
];

function expected(role: StaffRoleCode, permission: PermissionCode): boolean {
  if (role === "CEO") return true;
  if (role === "MANAGER") return !CEO_ONLY_PERMISSIONS.includes(permission);
  return EMPLOYEE_ALLOWED.includes(permission);
}

describeDb("permission matrix", () => {
  let granted: Map<StaffRoleCode, Set<string>>;

  beforeAll(async () => {
    const rows = await query<{ role_code: StaffRoleCode; permission_code: string }>(
      "SELECT role_code, permission_code FROM role_permission",
    );
    granted = new Map(STAFF_ROLES.map((role) => [role, new Set<string>()]));
    for (const row of rows) granted.get(row.role_code)?.add(row.permission_code);
  });

  afterAll(closePool);

  it("has exactly three roles, no more", async () => {
    const rows = await query<{ code: string }>("SELECT code FROM staff_role ORDER BY rank");
    expect(rows.map((r) => r.code)).toEqual(["CEO", "MANAGER", "EMPLOYEE"]);
  });

  it("protects the CEO role from editing", async () => {
    const rows = await query<{ code: string; is_protected: boolean }>(
      "SELECT code, is_protected FROM staff_role",
    );
    expect(rows.find((r) => r.code === "CEO")?.is_protected).toBe(true);
    expect(rows.find((r) => r.code === "MANAGER")?.is_protected).toBe(false);
  });

  it("keeps the code catalogue and the database catalogue in step", async () => {
    const rows = await query<{ code: string }>("SELECT code FROM permission ORDER BY code");
    expect(rows.map((r) => r.code).sort()).toEqual([...PERMISSIONS].sort());
  });

  // The matrix itself: every role against every permission, in both directions.
  for (const role of STAFF_ROLES) {
    for (const permission of PERMISSIONS) {
      const shouldAllow = expected(role, permission);
      it(`${role} is ${shouldAllow ? "allowed" : "denied"} ${permission}`, () => {
        expect(granted.get(role)?.has(permission) ?? false).toBe(shouldAllow);
      });
    }
  }

  it("grants no role but CEO a permission that confers full control", () => {
    for (const permission of CEO_ONLY_PERMISSIONS) {
      expect(granted.get("MANAGER")?.has(permission)).toBe(false);
      expect(granted.get("EMPLOYEE")?.has(permission)).toBe(false);
      expect(granted.get("CEO")?.has(permission)).toBe(true);
    }
  });

  it("gives the employee role no access to money or settings", () => {
    for (const permission of [
      "payment.confirm",
      "settings.manage",
      "role.manage",
      "staff.manage",
      "product.manage",
    ] as const) {
      expect(granted.get("EMPLOYEE")?.has(permission)).toBe(false);
    }
  });
});
