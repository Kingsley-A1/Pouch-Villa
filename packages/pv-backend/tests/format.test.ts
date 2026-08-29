import { describe, expect, it } from "vitest";
import { availabilityLabel, formatNaira, parseVariants } from "../src/domain/format";

describe("domain formatting", () => {
  it("formats demonstration prices for Nigeria", () => {
    expect(formatNaira(18500)).toContain("18,500");
  });

  it("returns safe empty variants for malformed JSON", () => {
    expect(parseVariants("not-json")).toEqual([]);
  });

  it("uses customer-facing availability labels", () => {
    expect(availabilityLabel("out_of_stock")).toBe("Out of stock");
  });
});
