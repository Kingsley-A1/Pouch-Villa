import { beforeAll, describe, expect, it } from "vitest";
import { presignUpload } from "../src/storage/r2";

describe("R2 upload presigning", () => {
  beforeAll(() => {
    process.env.R2_ENDPOINT = "https://example.r2.cloudflarestorage.com";
    process.env.R2_ACCESS_KEY_ID = "test-access-key";
    process.env.R2_SECRET_ACCESS_KEY = "test-secret-key";
    process.env.R2_PUBLIC_BUCKET_NAME = "test-public";
  });

  it("does not add the AWS checksum query fields unsupported by R2", async () => {
    const upload = await presignUpload("public", "products/test/original", "image/png", 1024);

    expect(upload.url).not.toContain("x-amz-sdk-checksum-algorithm");
    expect(upload.url).not.toContain("x-amz-checksum-crc32");
  });

  /**
   * The second half of the same defect, and the reason the size argument must be
   * the file's real length rather than the cap.
   *
   * SigV4 folds a present `content-length` into the signature, so the URL is a
   * promise about the number of bytes the browser will send. Passing the 10MiB
   * cap here — which is what this once did — made that promise false for every
   * file that was not exactly 10MiB, and R2 rejected the lot as a signature
   * mismatch: admin product images and customer payment receipts alike.
   */
  it("signs the exact length it was given, so a real file matches it", async () => {
    const upload = await presignUpload("public", "products/test/original", "image/png", 2048);
    const signed = new URL(upload.url).searchParams.get("X-Amz-SignedHeaders") ?? "";

    expect(signed.split(";")).toContain("content-length");
    // Different lengths must produce different signatures. Were the cap being
    // signed instead of the argument, these two would be identical.
    const other = await presignUpload("public", "products/test/original", "image/png", 4096);
    expect(new URL(upload.url).searchParams.get("X-Amz-Signature")).not.toBe(
      new URL(other.url).searchParams.get("X-Amz-Signature"),
    );
  });

  it("expires, so a leaked link is not a standing write grant", async () => {
    const upload = await presignUpload("public", "products/test/original", "image/webp", 1024);

    expect(upload.expiresIn).toBeGreaterThan(0);
    expect(Number(new URL(upload.url).searchParams.get("X-Amz-Expires"))).toBe(upload.expiresIn);
  });
});
