import { describe, expect, it } from "vitest";
import { koboFromDatabase, parseNairaToKobo } from "../src/domain/money";

describe("money boundaries", () => {
  it("converts the string returned for a Cockroach INT8 into branded kobo", () => {
    expect(koboFromDatabase("250000")).toBe(250000);
  });

  it("parses grouped naira without floating-point multiplication at the form boundary", () => {
    expect(parseNairaToKobo("2,500")).toBe(250000);
    expect(parseNairaToKobo("2,500.75")).toBe(250075);
  });
});
