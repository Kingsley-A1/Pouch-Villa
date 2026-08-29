import { createHash, randomInt, timingSafeEqual } from "node:crypto";

/**
 * Three access levels and no more. The scope names CEO, Manager and Employee, so
 * these are the roles — not a broader set the admin has to map onto them.
 */
export const STAFF_ROLES = ["CEO", "MANAGER", "EMPLOYEE"] as const;
export type StaffRoleCode = (typeof STAFF_ROLES)[number];

export function isStaffRole(value: string): value is StaffRoleCode {
  return (STAFF_ROLES as readonly string[]).includes(value);
}

/**
 * Ambiguous characters are excluded, because these codes get read off a screen and
 * typed on a phone: no O/0, no I/1/L. 8 characters from a 32-symbol alphabet is
 * about 40 bits, which is far beyond guessable given codes expire, are rate
 * limited, and are consumed on first use.
 */
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export const CODE_LENGTH = 8;

export function generateRoleCode(): string {
  let code = "";
  for (let index = 0; index < CODE_LENGTH; index += 1) {
    code += ALPHABET[randomInt(ALPHABET.length)];
  }
  return code;
}

/** Uppercased and stripped of spacing, so a code typed with dashes still works. */
export function normaliseRoleCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/**
 * Only the hash is stored. Reading the database does not hand anyone a usable code,
 * and the plaintext exists exactly once — in the output of the command that minted it.
 */
export function hashRoleCode(code: string): string {
  return createHash("sha256").update(normaliseRoleCode(code)).digest("hex");
}

export function roleCodeMatches(input: string, storedHash: string): boolean {
  const candidate = Buffer.from(hashRoleCode(input), "hex");
  const stored = Buffer.from(storedHash, "hex");
  if (candidate.length !== stored.length) return false;
  return timingSafeEqual(candidate, stored);
}

/** Formatted for reading aloud or copying: PVCE-4827-1930 style grouping. */
export function formatRoleCodeForDisplay(code: string): string {
  const normalised = normaliseRoleCode(code);
  return normalised.replace(/(.{4})(?=.)/g, "$1-");
}

export type RoleCodeRecord = {
  role_code: string;
  max_uses: number;
  used_count: number;
  expires_at: Date;
  revoked_at: Date | null;
};

export type RoleCodeRejection = "revoked" | "expired" | "exhausted";

/**
 * Whether a code may still be redeemed. Returns a reason rather than a boolean so
 * the caller can audit precisely why a redemption was refused — though what the
 * user is told stays deliberately vague, since distinguishing "expired" from
 * "never existed" tells an attacker which codes are real.
 */
export function roleCodeRejection(
  record: RoleCodeRecord,
  now: Date = new Date(),
): RoleCodeRejection | null {
  if (record.revoked_at !== null) return "revoked";
  if (record.expires_at.getTime() <= now.getTime()) return "expired";
  if (record.used_count >= record.max_uses) return "exhausted";
  return null;
}
