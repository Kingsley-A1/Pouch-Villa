import { describe, expect, it } from "vitest";
import { isDark, qrMatrix } from "../src/documents/qr";

/**
 * The QR code on every invoice.
 *
 * This cannot prove that a phone will scan it — only a scanner can, and one does
 * during review. What it can prove is that the grid coming out of the encoder is
 * a QR code rather than a plausible-looking square of noise, which is the shape
 * this fails in if the module data is ever read the wrong way round. Every
 * assertion below is a structural rule from the specification, so a wrong
 * reading fails here rather than in somebody's hand.
 */

const PAYLOAD = "https://test.invalid/orders/PV-7Q4K2-M8XZP";

describe("qrMatrix", () => {
  it("is square, and a valid QR version size", () => {
    const matrix = qrMatrix(PAYLOAD);

    // Every version is 4v + 17 modules per side, from 21 (v1) to 177 (v40).
    expect((matrix.size - 17) % 4).toBe(0);
    expect(matrix.size).toBeGreaterThanOrEqual(21);
    expect(matrix.size).toBeLessThanOrEqual(177);
    expect(matrix.dark).toHaveLength(matrix.size * matrix.size);
  });

  it("puts a finder pattern in three corners and not the fourth", () => {
    const matrix = qrMatrix(PAYLOAD);
    const last = matrix.size - 7;

    // A finder is a 7x7 ring: dark border, light inside it, dark 3x3 core. If
    // the byte data were ever read as packed bits, this is what would break.
    for (const [row, column] of [
      [0, 0],
      [0, last],
      [last, 0],
    ] as const) {
      expect(isDark(matrix, row + 0, column + 0)).toBe(true);
      expect(isDark(matrix, row + 1, column + 1)).toBe(false);
      expect(isDark(matrix, row + 3, column + 3)).toBe(true);
    }

    // The fourth corner carries no finder — that asymmetry is how a scanner
    // works out which way up the code is.
    expect(isDark(matrix, last + 1, last + 1)).toBe(false);
  });

  it("encodes the payload, not a constant", () => {
    const one = qrMatrix("https://test.invalid/orders/PV-AAAAA-AAAAA");
    const two = qrMatrix("https://test.invalid/orders/PV-BBBBB-BBBBB");

    expect(one.dark).not.toEqual(two.dark);
  });

  it("is stable for the same payload", () => {
    // Mask selection is deterministic, so two receipts for one order carry the
    // identical code rather than two that merely both work.
    expect(qrMatrix(PAYLOAD).dark).toEqual(qrMatrix(PAYLOAD).dark);
  });

  it("refuses an empty payload rather than drawing an empty code", () => {
    expect(() => qrMatrix("")).toThrow(/payload/i);
  });
});
