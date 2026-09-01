import { describe, expect, it } from "vitest";
import { hashSync } from "bcryptjs";
import {
  MINIMUM_PASSWORD_LENGTH,
  PasswordTooShortError,
  assertPasswordLength,
  hashPassword,
  needsRehash,
  verifyPassword,
} from "../src/auth/password";
import {
  BreachedPasswordError,
  assertPasswordNotBreached,
  checkPasswordBreached,
} from "../src/auth/breach-check";

const PASSWORD = "correct horse battery staple";

describe("password hashing", () => {
  it("hashes with Argon2id, per ADR 0004", async () => {
    const hash = await hashPassword(PASSWORD);
    expect(hash.startsWith("$argon2id$")).toBe(true);
    expect(hash).toContain("m=19456");
    expect(hash).toContain("t=2");
    expect(hash).toContain("p=1");
  });

  it("salts, so the same password never produces the same hash twice", async () => {
    const [first, second] = await Promise.all([hashPassword(PASSWORD), hashPassword(PASSWORD)]);
    expect(first).not.toBe(second);
    expect(await verifyPassword(PASSWORD, first)).toBe(true);
    expect(await verifyPassword(PASSWORD, second)).toBe(true);
  });

  it("verifies the right password and refuses the wrong one", async () => {
    const hash = await hashPassword(PASSWORD);
    expect(await verifyPassword(PASSWORD, hash)).toBe(true);
    expect(await verifyPassword("a completely different one", hash)).toBe(false);
    expect(await verifyPassword(`${PASSWORD} `, hash)).toBe(false);
  });

  it("enforces one minimum length, everywhere", async () => {
    expect(MINIMUM_PASSWORD_LENGTH).toBe(12);
    const tooShort = "x".repeat(MINIMUM_PASSWORD_LENGTH - 1);
    await expect(hashPassword(tooShort)).rejects.toThrow(PasswordTooShortError);
    expect(() => assertPasswordLength(tooShort)).toThrow(PasswordTooShortError);
    expect(() => assertPasswordLength("x".repeat(MINIMUM_PASSWORD_LENGTH))).not.toThrow();
  });

  /**
   * bcrypt truncates silently at 72 bytes, so two different long passwords open
   * the same account. Argon2id does not. This is one of the three reasons ADR
   * 0004 gives for the change, so it is the one worth a regression test.
   */
  it("does not truncate a long passphrase", async () => {
    const long = "a".repeat(72);
    const longer = `${long}-and-then-some-more-entirely-different-words`;
    const hash = await hashPassword(long);
    expect(await verifyPassword(long, hash)).toBe(true);
    expect(await verifyPassword(longer, hash)).toBe(false);
  });

  it("treats a malformed hash as a failed verification, not a crash", async () => {
    expect(await verifyPassword(PASSWORD, "not-a-hash")).toBe(false);
    expect(await verifyPassword(PASSWORD, "")).toBe(false);
    expect(await verifyPassword(PASSWORD, "$argon2id$truncated")).toBe(false);
  });
});

describe("bcrypt migration", () => {
  it("still verifies a hash made before ADR 0004", async () => {
    const legacy = hashSync(PASSWORD, 10);
    expect(await verifyPassword(PASSWORD, legacy)).toBe(true);
    expect(await verifyPassword("wrong", legacy)).toBe(false);
  });

  it("flags a bcrypt hash for upgrade and leaves an Argon2id one alone", async () => {
    expect(needsRehash(hashSync(PASSWORD, 10))).toBe(true);
    expect(needsRehash(await hashPassword(PASSWORD))).toBe(false);
  });
});

describe("breach checking", () => {
  /** A stub, so the suite never depends on a third-party service being up. */
  function respondWith(body: string, ok = true): typeof fetch {
    return (async () => ({ ok, text: async () => body })) as unknown as typeof fetch;
  }

  it("never sends the password or its full hash", async () => {
    let requested = "";
    const spy = (async (url: string | URL) => {
      requested = String(url);
      return { ok: true, text: async () => "" };
    }) as unknown as typeof fetch;

    await checkPasswordBreached(PASSWORD, spy);
    expect(requested).not.toContain(PASSWORD);
    // Only the five-character prefix goes over the wire.
    expect(requested).toMatch(/\/range\/[0-9A-F]{5}$/);
  });

  it("finds a password whose suffix is in the range response", async () => {
    const { createHash } = await import("node:crypto");
    const digest = createHash("sha1").update(PASSWORD, "utf8").digest("hex").toUpperCase();
    const suffix = digest.slice(5);

    const result = await checkPasswordBreached(
      PASSWORD,
      respondWith(`0000000000000000000000000000000000:3\r\n${suffix}:64123\r\n`),
    );
    expect(result).toEqual({ checked: true, breached: true, occurrences: 64123 });
    await expect(
      assertPasswordNotBreached(PASSWORD, respondWith(`${suffix}:64123`)),
    ).rejects.toThrow(BreachedPasswordError);
  });

  it("passes a password that is not in the response", async () => {
    const result = await checkPasswordBreached(PASSWORD, respondWith("ABCDEF0123456789:9"));
    expect(result).toEqual({ checked: true, breached: false });
  });

  /** Padding entries carry a count of zero and must not read as a hit. */
  it("ignores the zero-count padding entries", async () => {
    const { createHash } = await import("node:crypto");
    const digest = createHash("sha1").update(PASSWORD, "utf8").digest("hex").toUpperCase();
    const result = await checkPasswordBreached(PASSWORD, respondWith(`${digest.slice(5)}:0`));
    expect(result).toEqual({ checked: true, breached: false });
  });

  /**
   * ADR 0004: a Nigerian customer must not be blocked from creating an account
   * because a foreign API is having an afternoon.
   */
  it("fails open when the service is unreachable or unhappy", async () => {
    const exploding = (async () => {
      throw new Error("network is down");
    }) as unknown as typeof fetch;

    expect(await checkPasswordBreached(PASSWORD, exploding)).toEqual({ checked: false });
    expect(await checkPasswordBreached(PASSWORD, respondWith("", false))).toEqual({
      checked: false,
    });
    // And the assert form accepts the password rather than throwing.
    await expect(assertPasswordNotBreached(PASSWORD, exploding)).resolves.toEqual({
      checked: false,
    });
  });
});
