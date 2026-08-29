import { describe, expect, it } from "vitest";
import {
  CODE_LENGTH,
  STAFF_ROLES,
  formatRoleCodeForDisplay,
  generateRoleCode,
  hashRoleCode,
  isStaffRole,
  normaliseRoleCode,
  roleCodeMatches,
  roleCodeRejection,
  type RoleCodeRecord,
} from "../src/auth/role-codes";

const future = (ms: number) => new Date(Date.now() + ms);

function record(overrides: Partial<RoleCodeRecord> = {}): RoleCodeRecord {
  return {
    role_code: "MANAGER",
    max_uses: 1,
    used_count: 0,
    expires_at: future(60_000),
    revoked_at: null,
    ...overrides,
  };
}

describe("staff role codes", () => {
  it("offers exactly three access levels", () => {
    expect(STAFF_ROLES).toEqual(["CEO", "MANAGER", "EMPLOYEE"]);
    expect(isStaffRole("OWNER")).toBe(false);
    expect(isStaffRole("CEO")).toBe(true);
  });

  it("generates codes without characters that are misread on a phone", () => {
    for (let attempt = 0; attempt < 200; attempt += 1) {
      const code = generateRoleCode();
      expect(code).toHaveLength(CODE_LENGTH);
      expect(code).not.toMatch(/[OIL01]/);
    }
  });

  it("does not repeat itself across many mints", () => {
    const seen = new Set(Array.from({ length: 500 }, () => generateRoleCode()));
    expect(seen.size).toBe(500);
  });

  it("accepts a code typed with the display dashes", () => {
    const code = generateRoleCode();
    const hash = hashRoleCode(code);
    expect(roleCodeMatches(formatRoleCodeForDisplay(code), hash)).toBe(true);
    expect(roleCodeMatches(code.toLowerCase(), hash)).toBe(true);
    expect(normaliseRoleCode("pvce-4827")).toBe("PVCE4827");
  });

  it("rejects a code that does not match", () => {
    expect(roleCodeMatches("WRONGCODE", hashRoleCode(generateRoleCode()))).toBe(false);
  });

  it("stores only the hash, never the code", () => {
    const code = generateRoleCode();
    const hash = hashRoleCode(code);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain(code);
  });

  describe("redeemability", () => {
    it("accepts a fresh, unused, unrevoked code", () => {
      expect(roleCodeRejection(record())).toBeNull();
    });

    it("refuses a revoked code even while it is otherwise valid", () => {
      expect(roleCodeRejection(record({ revoked_at: new Date() }))).toBe("revoked");
    });

    it("refuses an expired code", () => {
      expect(roleCodeRejection(record({ expires_at: future(-1) }))).toBe("expired");
    });

    it("refuses a single-use code that has already been redeemed", () => {
      expect(roleCodeRejection(record({ used_count: 1 }))).toBe("exhausted");
    });

    it("allows a multi-use code until its uses run out", () => {
      expect(roleCodeRejection(record({ max_uses: 3, used_count: 2 }))).toBeNull();
      expect(roleCodeRejection(record({ max_uses: 3, used_count: 3 }))).toBe("exhausted");
    });
  });
});
