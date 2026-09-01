import { sniffImageFormat, type ImageFormat } from "./image-formats";

/**
 * Validation for a payment proof.
 *
 * This is deliberately separate from `images.ts`. Product media is re-encoded
 * into WebP derivatives and served from a public CDN; a payment proof is a
 * **financial document** that is stored once, privately, and shown only to a
 * staff member who is authorised and audited. The two have different accepted
 * formats, different size limits and opposite storage rules, so sharing one
 * module would mean one set of constants pulled in two directions.
 *
 * PDF is accepted here and nowhere else: Nigerian bank apps commonly produce a
 * PDF receipt, and refusing it would push customers into screenshotting a PDF.
 *
 * As everywhere, the declared MIME type and the file extension are
 * attacker-controlled and neither is trusted — the leading bytes decide.
 */

export class UnsupportedProofError extends Error {
  constructor() {
    super("Upload a JPEG, PNG, WebP or PDF of your transfer receipt.");
    this.name = "UnsupportedProofError";
  }
}

export class ProofTooLargeError extends Error {
  constructor(maxBytes: number) {
    super(`That file is larger than ${Math.round(maxBytes / 1024 / 1024)}MB.`);
    this.name = "ProofTooLargeError";
  }
}

/**
 * Smaller than the product-media limit. A receipt is a screenshot or a one-page
 * PDF, and a customer on Nigerian mobile data should not be uploading more.
 */
export const MAX_PROOF_BYTES = 8 * 1024 * 1024;

export type ProofFormat = ImageFormat | "pdf";

export const PROOF_MIME_TYPES: Readonly<Record<ProofFormat, string>> = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  avif: "image/avif",
  pdf: "application/pdf",
};

/** The formats a browser file picker should offer. */
export const ACCEPTED_PROOF_MIME = "image/jpeg,image/png,image/webp,application/pdf";

export function sniffProofFormat(bytes: Buffer): ProofFormat | null {
  if (bytes.length < 12) return null;
  // %PDF-
  if (bytes.subarray(0, 5).toString("ascii") === "%PDF-") return "pdf";
  return sniffImageFormat(bytes);
}

export type ValidatedProof = {
  format: ProofFormat;
  contentType: string;
  byteSize: number;
};

export function validateProof(bytes: Buffer): ValidatedProof {
  if (bytes.length === 0) throw new UnsupportedProofError();
  if (bytes.length > MAX_PROOF_BYTES) throw new ProofTooLargeError(MAX_PROOF_BYTES);

  const format = sniffProofFormat(bytes);
  if (format === null) throw new UnsupportedProofError();

  return {
    format,
    contentType: PROOF_MIME_TYPES[format],
    byteSize: bytes.length,
  };
}

/**
 * Proof keys are namespaced by order and carry the content hash, so re-uploading
 * the identical file is idempotent at the storage layer and two orders can never
 * collide. They are never guessable from the order reference alone, which
 * matters because the bucket is private but keys still travel in signed URLs.
 */
export function proofKey(orderId: string, hash: string, format: ProofFormat): string {
  const extension = format === "pdf" ? "pdf" : format;
  return `proofs/${orderId}/${hash}.${extension}`;
}
