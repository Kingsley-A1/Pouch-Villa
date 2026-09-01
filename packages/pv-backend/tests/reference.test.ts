import { describe, expect, it } from "vitest";
import {
  REFERENCE_PATTERN,
  generateIdempotencyKey,
  generateOrderReference,
  isOrderReference,
  normaliseOrderReference,
} from "../src/domain/reference";

describe("order references", () => {
  it("produces the documented shape", () => {
    for (let attempt = 0; attempt < 200; attempt += 1) {
      const reference = generateOrderReference();
      expect(reference).toMatch(REFERENCE_PATTERN);
      expect(isOrderReference(reference)).toBe(true);
    }
  });

  it("omits the characters people misread when typing from a screen", () => {
    for (let attempt = 0; attempt < 500; attempt += 1) {
      expect(generateOrderReference().slice(3)).not.toMatch(/[OIL01]/);
    }
  });

  /**
   * The prototype used Math.random() and four digits into a UNIQUE column, which
   * collides at a few dozen orders and fails a real customer's checkout. This is
   * the regression guard for that, not a test of the crypto library.
   */
  it("does not collide across a volume the shop could really reach", () => {
    const total = 20_000;
    const seen = new Set(Array.from({ length: total }, () => generateOrderReference()));
    expect(seen.size).toBe(total);
  });

  it("accepts what a customer actually types", () => {
    const reference = generateOrderReference();
    const body = reference.slice(3).replace("-", "");

    expect(normaliseOrderReference(reference)).toBe(reference);
    expect(normaliseOrderReference(reference.toLowerCase())).toBe(reference);
    expect(normaliseOrderReference(`  ${reference}  `)).toBe(reference);
    // Spaces instead of hyphens, and the prefix left off entirely.
    expect(normaliseOrderReference(reference.replace(/-/g, " "))).toBe(reference);
    expect(normaliseOrderReference(body)).toBe(reference);
    expect(normaliseOrderReference(body.toLowerCase())).toBe(reference);
  });

  it("refuses input that could never be a reference", () => {
    expect(normaliseOrderReference("")).toBeNull();
    expect(normaliseOrderReference("PV-ABC")).toBeNull();
    // O, I, L, 0 and 1 are not in the alphabet, so these are not near-misses to
    // be helpfully corrected — they are a different string.
    expect(normaliseOrderReference("PV-OOOOO-IIIII")).toBeNull();
    expect(normaliseOrderReference("PV-23456-2345678")).toBeNull();
    expect(isOrderReference("PV-2345-6789")).toBe(false);
  });
});

describe("idempotency keys", () => {
  it("generates keys long enough not to repeat", () => {
    const total = 5_000;
    const seen = new Set(Array.from({ length: total }, () => generateIdempotencyKey()));
    expect(seen.size).toBe(total);
    expect(generateIdempotencyKey()).toHaveLength(32);
  });
});
