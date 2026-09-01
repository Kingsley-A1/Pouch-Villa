import { randomBytes } from "node:crypto";
import { compareSync } from "bcryptjs";
import { argon2id, argon2Verify } from "hash-wasm";

/**
 * Password hashing, per AGENTS.md §5 and docs/decisions/0004-password-hashing.md.
 *
 * One minimum, applied everywhere. The prototype enforced 8 at the seed path and
 * 12 in the staff form, so a seeded account could hold a password the UI would
 * reject.
 *
 * Hashing is Argon2id. bcrypt verification survives only to migrate the hashes
 * that predate this — see `needsRehash`.
 */

export const MINIMUM_PASSWORD_LENGTH = 12;

/** OWASP's current low-memory Argon2id profile. */
const MEMORY_KIB = 19_456;
const ITERATIONS = 2;
const PARALLELISM = 1;
const HASH_LENGTH = 32;
const SALT_BYTES = 16;

export class PasswordTooShortError extends Error {
  constructor() {
    super(`A password must be at least ${MINIMUM_PASSWORD_LENGTH} characters.`);
    this.name = "PasswordTooShortError";
  }
}

export function assertPasswordLength(password: string) {
  if (password.length < MINIMUM_PASSWORD_LENGTH) throw new PasswordTooShortError();
}

export async function hashPassword(password: string): Promise<string> {
  assertPasswordLength(password);
  return argon2id({
    password,
    salt: randomBytes(SALT_BYTES),
    parallelism: PARALLELISM,
    iterations: ITERATIONS,
    memorySize: MEMORY_KIB,
    hashLength: HASH_LENGTH,
    outputType: "encoded",
  });
}

/**
 * bcrypt hashes start `$2a$`, `$2b$` or `$2y$`; Argon2id hashes start
 * `$argon2id$`. The stored hash says which function produced it, so there is no
 * separate column to keep in step and no account can be left unverifiable.
 */
function isBcrypt(hash: string): boolean {
  return /^\$2[aby]?\$/.test(hash);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  if (isBcrypt(hash)) return compareSync(password, hash);
  try {
    return await argon2Verify({ password, hash });
  } catch {
    // A malformed or truncated hash is a failed verification, not a crash. It
    // must not be distinguishable from a wrong password to a caller.
    return false;
  }
}

/**
 * True where the stored hash was produced by an algorithm we no longer use, so
 * the caller can rehash it in the same transaction as a successful sign-in.
 * Nobody is forced to reset a password and nobody notices the change.
 */
export function needsRehash(hash: string): boolean {
  return isBcrypt(hash);
}
