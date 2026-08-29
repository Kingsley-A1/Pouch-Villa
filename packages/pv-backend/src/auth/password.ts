import { compareSync, hashSync } from "bcryptjs";

/**
 * One minimum, applied everywhere. The prototype enforced 8 at the seed path and 12
 * in the staff form, so a seeded account could hold a password the UI would reject.
 */
export const MINIMUM_PASSWORD_LENGTH = 12;

const HASH_ROUNDS = 12;

export function hashPassword(password: string) {
  if (password.length < MINIMUM_PASSWORD_LENGTH) {
    throw new Error(`A password must be at least ${MINIMUM_PASSWORD_LENGTH} characters.`);
  }
  return hashSync(password, HASH_ROUNDS);
}

export function verifyPassword(password: string, hash: string) {
  return compareSync(password, hash);
}
