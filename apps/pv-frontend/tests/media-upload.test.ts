import { describe, expect, it } from "vitest";
import { MAX_IMAGE_BYTES as SERVER_MAX } from "@pv/backend/storage/image-formats";
import {
  ACCEPTED_MEDIA_TYPES,
  MAX_IMAGE_BYTES,
  rejectionReason,
} from "@/app/admin/(protected)/products/upload-image";

function fileOf(name: string, type: string, size: number): File {
  const file = new File(["x"], name, { type });
  // `File` cannot be constructed at an arbitrary size in jsdom without
  // allocating it, and a 30MB allocation per case is not worth the seconds.
  Object.defineProperty(file, "size", { value: size });
  return file;
}

/**
 * The browser-side gate is a courtesy, never the enforcement — the authority is
 * the byte count measured server-side after the object is fetched back. But it
 * has to agree with the server about what the limit *is*, or staff are told a
 * file is fine and then watch it fail four minutes later.
 */
describe("client-side upload limits", () => {
  it("uses the same byte cap as the server", () => {
    expect(MAX_IMAGE_BYTES).toBe(SERVER_MAX);
  });

  it("accepts an image inside the limit", () => {
    expect(rejectionReason(fileOf("pouch.jpg", "image/jpeg", 2_000_000))).toBeNull();
  });

  it("refuses a file that is not an accepted image, by name", () => {
    const reason = rejectionReason(fileOf("receipt.pdf", "application/pdf", 1000));
    expect(reason).toContain("receipt.pdf");
    expect(reason).toContain("JPEG");
  });

  it("refuses an oversized image before a minute of mobile data is spent on it", () => {
    const reason = rejectionReason(fileOf("huge.png", "image/png", MAX_IMAGE_BYTES + 1));
    expect(reason).toContain("huge.png");
    expect(reason).toContain("10MB");
  });

  it("offers exactly the formats the server will finalise", () => {
    expect(ACCEPTED_MEDIA_TYPES).toEqual(["image/jpeg", "image/png", "image/webp", "image/avif"]);
  });
});
