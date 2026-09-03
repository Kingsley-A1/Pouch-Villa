import { describe, expect, it } from "vitest";
import { describeUploadFailure } from "@/lib/upload-error";

describe("upload failure message", () => {
  it("identifies browser network and storage-policy failures", () => {
    expect(describeUploadFailure(new TypeError("Failed to fetch"))).toContain("storage connection");
  });
});
