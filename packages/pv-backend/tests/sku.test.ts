import { describe, expect, it } from "vitest";
import { skuFromProductName } from "../src/domain/sku";

describe("generated product SKU", () => {
  it("uses a readable product stem and a four-character uppercase code", () => {
    expect(skuFromProductName("  iPhone 15 Pro Case  ", "a7z2")).toBe("IPHONE-15-PRO-CASE-A7Z2");
  });

  it("uses PRODUCT when the name has no ASCII SKU characters", () => {
    expect(skuFromProductName("phone emoji", "9k2m")).toBe("PHONE-EMOJI-9K2M");
  });
});
