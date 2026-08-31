import { describe, expect, it } from "vitest";
import { toSingle } from "@/lib/utils";

describe("presentation utilities", () => {
  it("normalizes URL values", () => {
    expect(toSingle(["apple", "samsung"])).toBe("apple");
    expect(toSingle("apple")).toBe("apple");
    expect(toSingle(undefined)).toBe("");
  });
});
