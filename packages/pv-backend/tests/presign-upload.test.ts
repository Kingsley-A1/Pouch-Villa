import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { presignUpload } from "../src/storage/r2";

/**
 * The regression test for the bug that broke every upload in the app.
 *
 * `presignUpload` used to pass the size cap as `ContentLength`, and SigV4 folds
 * a present header into the signature. The URL came back with
 * `X-Amz-SignedHeaders=content-length;host`, which is a promise that the
 * uploader will send `Content-Length: 10485760` exactly. A browser sends the
 * real length of the file, so R2 rejected every PUT with a signature mismatch —
 * admin product images and customer payment receipts alike.
 *
 * A signed header is a promise about a request the browser is going to make on
 * its own terms, so the only safe answer is to sign none of them. This asserts
 * that, at the level the bug actually lived: the query string.
 *
 * Presigning is local computation. No network and no real credentials.
 */
const original = { ...process.env };

beforeEach(() => {
  process.env.R2_ENDPOINT = "https://account.r2.cloudflarestorage.com";
  process.env.R2_ACCESS_KEY_ID = "test-access-key";
  process.env.R2_SECRET_ACCESS_KEY = "test-secret-key";
  process.env.R2_PUBLIC_BUCKET_NAME = "pv-public";
  process.env.R2_PRIVATE_BUCKET_NAME = "pv-private";
});

afterEach(() => {
  process.env = { ...original };
});

function signedHeaders(url: string): string[] {
  const value = new URL(url).searchParams.get("X-Amz-SignedHeaders") ?? "";
  return value.split(";").filter(Boolean);
}

describe("presigned upload URL", () => {
  it("signs the host and nothing else", async () => {
    const { url } = await presignUpload("public", "staging/p1/u1", "image/jpeg");

    expect(signedHeaders(url)).toEqual(["host"]);
  });

  /**
   * Stated as its own case because this is the exact failure: a browser cannot
   * be told what Content-Length to send, so committing the signature to one
   * value guarantees a mismatch for every file that is not precisely that size.
   */
  it("never commits the uploader to a content-length it cannot control", async () => {
    const { url } = await presignUpload("private", "staging/proofs/o1/u1", "application/pdf");

    expect(signedHeaders(url)).not.toContain("content-length");
  });

  it("addresses the bucket the caller asked for", async () => {
    const publicUrl = await presignUpload("public", "staging/p1/u1", "image/png");
    const privateUrl = await presignUpload("private", "staging/proofs/o1/u1", "image/png");

    expect(publicUrl.url).toContain("pv-public");
    expect(privateUrl.url).toContain("pv-private");
  });

  it("expires, so a leaked link is not a standing write grant", async () => {
    const { url, expiresIn } = await presignUpload("public", "staging/p1/u1", "image/webp");

    expect(expiresIn).toBeGreaterThan(0);
    expect(Number(new URL(url).searchParams.get("X-Amz-Expires"))).toBe(expiresIn);
  });
});
