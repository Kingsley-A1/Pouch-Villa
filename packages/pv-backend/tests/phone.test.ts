import { describe, expect, it } from "vitest";
import {
  InvalidPhoneNumberError,
  assertPhone,
  formatPhoneLocal,
  isPhone,
  maskPhone,
  normalisePhone,
} from "../src/domain/phone";

/**
 * Fixture numbers only. They live here because tests are exempt from the
 * hardcoded-business-fact check (AGENTS.md §4) — a real number must never appear
 * in src/.
 */
const NATIONAL = "8031234567";
const CANONICAL = `+234${NATIONAL}`;

describe("phone normalisation", () => {
  /**
   * ADR 0002 authorises order tracking by reference + registered phone, which
   * makes this security-bearing: a number stored in three shapes means two of
   * those shapes fail to open their owner's own order.
   */
  it("maps every shape a customer types to one canonical form", () => {
    const shapes = [
      CANONICAL,
      `234${NATIONAL}`,
      `0${NATIONAL}`,
      NATIONAL,
      `0${NATIONAL.slice(0, 3)} ${NATIONAL.slice(3, 6)} ${NATIONAL.slice(6)}`,
      `0${NATIONAL.slice(0, 3)}-${NATIONAL.slice(3, 6)}-${NATIONAL.slice(6)}`,
      `(0${NATIONAL.slice(0, 3)}) ${NATIONAL.slice(3)}`,
      `  ${CANONICAL}  `,
    ];
    for (const shape of shapes) {
      expect(normalisePhone(shape), `${shape} should normalise`).toBe(CANONICAL);
    }
  });

  it("accepts the mobile prefixes in use and refuses the rest", () => {
    for (const leading of ["7", "8", "9"]) {
      expect(normalisePhone(`0${leading}${NATIONAL.slice(1)}`)).not.toBeNull();
    }
    // A landline cannot receive the delivery coordination this number exists
    // for, so it is refused at the boundary rather than discovered on the day.
    for (const leading of ["1", "2", "3", "4", "5", "6"]) {
      expect(normalisePhone(`0${leading}${NATIONAL.slice(1)}`)).toBeNull();
    }
  });

  it("refuses anything of the wrong length", () => {
    expect(normalisePhone("")).toBeNull();
    expect(normalisePhone("   ")).toBeNull();
    expect(normalisePhone("803")).toBeNull();
    expect(normalisePhone(`${NATIONAL}99`)).toBeNull();
    expect(normalisePhone("not a number")).toBeNull();
    expect(normalisePhone("+1 555 0100")).toBeNull();
  });

  it("throws a named error where a caller wants one", () => {
    expect(assertPhone(`0${NATIONAL}`)).toBe(CANONICAL);
    expect(() => assertPhone("nonsense")).toThrow(InvalidPhoneNumberError);
    try {
      assertPhone("nonsense");
    } catch (error) {
      expect((error as Error).name).toBe("InvalidPhoneNumberError");
    }
    expect(isPhone(`0${NATIONAL}`)).toBe(true);
    expect(isPhone("nonsense")).toBe(false);
  });

  it("is idempotent, so re-normalising stored data cannot corrupt it", () => {
    const once = normalisePhone(`0${NATIONAL}`);
    expect(once).not.toBeNull();
    expect(normalisePhone(once as string)).toBe(once);
  });

  it("renders the local form staff actually read aloud", () => {
    expect(formatPhoneLocal(CANONICAL)).toBe(
      `0${NATIONAL.slice(0, 3)} ${NATIONAL.slice(3, 6)} ${NATIONAL.slice(6)}`,
    );
    // Anything unexpected comes back untouched rather than mangled.
    expect(formatPhoneLocal("+15550100")).toBe("+15550100");
  });

  it("masks all but the last three digits for identity confirmation", () => {
    const masked = maskPhone(CANONICAL);
    expect(masked).toContain(NATIONAL.slice(-3));
    expect(masked).not.toContain(NATIONAL.slice(0, 6));
  });
});
