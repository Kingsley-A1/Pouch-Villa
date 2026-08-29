import { describe, expect, it } from "vitest";
import { availabilityTone, toSingle } from "@/lib/utils";

describe("presentation utilities", () => {
  it("normalizes URL values", () => {
    expect(toSingle(["apple", "samsung"])).toBe("apple");
  });

  it("tones an unknown availability neutrally rather than as in stock", () => {
    expect(availabilityTone("out_of_stock")).not.toContain("emerald");
  });
});
