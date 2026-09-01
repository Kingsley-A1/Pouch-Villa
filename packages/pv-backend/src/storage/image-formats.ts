/**
 * Image rules and format sniffing — everything about images that does *not*
 * need sharp.
 *
 * Split from `images.ts` because that module imports sharp, a native addon that
 * dlopens libvips at module load. Any module that touches one of these
 * constants would otherwise drag the whole binary into its serverless bundle:
 * rendering the product edit screen, which only lists existing media, was
 * failing in production with ERR_DLOPEN_FAILED for exactly that reason.
 *
 * Nothing here reads a byte through a library. The declared MIME type and the
 * file extension are both attacker-controlled, so neither is trusted: the first
 * bytes of the buffer decide what the file is. A `.jpg` that is really an HTML
 * document is exactly how a stored-XSS gets served from a media domain.
 */

export class UnsupportedImageError extends Error {
  constructor() {
    super("That file is not a JPEG, PNG, WebP or AVIF image.");
    this.name = "UnsupportedImageError";
  }
}

export class ImageTooLargeError extends Error {
  constructor(maxBytes: number) {
    super(`That image is larger than ${Math.round(maxBytes / 1024 / 1024)}MB.`);
    this.name = "ImageTooLargeError";
  }
}

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export type ImageFormat = "jpeg" | "png" | "webp" | "avif";

/** Magic-byte signatures. Checked against the buffer, never the declared type. */
export function sniffImageFormat(bytes: Buffer): ImageFormat | null {
  if (bytes.length < 12) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpeg";
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "png";
  }
  // Both WebP and AVIF are containers: RIFF....WEBP and ....ftypavif respectively.
  if (
    bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
    bytes.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "webp";
  }
  if (bytes.subarray(4, 8).toString("ascii") === "ftyp") {
    const brand = bytes.subarray(8, 12).toString("ascii");
    if (brand === "avif" || brand === "avis") return "avif";
  }
  return null;
}

export const MIME_BY_FORMAT: Record<ImageFormat, string> = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  avif: "image/avif",
};

/**
 * Derivative widths. Generated once on upload rather than per request, so a
 * product page costs no transformation work and every image can be cached
 * immutably.
 */
export const DERIVATIVES = [
  { name: "thumb", width: 200 },
  { name: "card", width: 600 },
  { name: "hero", width: 1400 },
] as const;

export type DerivativeName = (typeof DERIVATIVES)[number]["name"];

export type ProcessedImage = {
  /** Intrinsic dimensions of the original, so every render reserves its box. */
  width: number;
  height: number;
  /** Content hash, so keys are immutable and identical bytes dedupe. */
  hash: string;
  renditions: { name: DerivativeName | "original"; format: "webp"; bytes: Buffer; width: number }[];
};
