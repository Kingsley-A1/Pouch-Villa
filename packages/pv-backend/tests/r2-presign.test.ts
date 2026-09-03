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
});
