import QRCode from "qrcode";

/**
 * A QR code as a grid of dark/light squares.
 *
 * **Why a matrix and not a PNG.** `qrcode` will happily hand back a raster, and
 * embedding one would mean choosing a pixel size now and living with it: too
 * small and a phone camera cannot resolve it off a printed page, too large and
 * every invoice carries a needless image stream. A PDF is a vector format, so
 * the renderer draws each dark module as a filled rectangle instead. The result
 * is exact at any zoom, prints at the printer's own resolution, and costs a few
 * kilobytes of drawing operations rather than an image.
 *
 * **Why the encoding is not written here.** Reed–Solomon error correction, mask
 * selection and version fitting are a specification, not a puzzle worth solving
 * again — and a subtly wrong implementation produces a code that scans on the
 * phone you tested with and fails on the customer's. This wraps the library that
 * already gets it right and keeps the wrapper narrow enough to replace.
 */

export type QrMatrix = {
  /** Modules per side, excluding the quiet zone. */
  readonly size: number;
  /** Row-major, `true` where the module is dark. */
  readonly dark: readonly boolean[];
};

/**
 * Medium correction, which tolerates about 15% damage.
 *
 * This code is printed on paper that will be folded, photographed and scanned
 * off a phone screen at an angle. Low correction would fit in a smaller grid;
 * medium is the level that still reads after a receipt has been in a pocket, and
 * the payload here is short enough that the extra redundancy costs one version
 * step at most.
 */
const ERROR_CORRECTION = "M" as const;

export function qrMatrix(payload: string): QrMatrix {
  if (payload.length === 0) {
    throw new Error("A QR code needs a payload.");
  }

  const created = QRCode.create(payload, { errorCorrectionLevel: ERROR_CORRECTION });
  const { size, data } = created.modules;

  // `data` is one byte per module with the low bit carrying darkness, not a
  // packed bitfield — reading it as bits would produce a plausible-looking grid
  // that scans as nothing.
  // `noUncheckedIndexedAccess` is right to make this explicit: the library
  // guarantees `data.length === size * size`, but nothing in the type says so,
  // and a short buffer must read as light rather than throw mid-render.
  const dark = Array.from(
    { length: size * size },
    (_unused, index) => ((data[index] ?? 0) & 1) === 1,
  );

  return { size, dark };
}

/** True where the module at (row, column) is dark. Bounds are the caller's. */
export function isDark(matrix: QrMatrix, row: number, column: number): boolean {
  return matrix.dark[row * matrix.size + column] === true;
}
