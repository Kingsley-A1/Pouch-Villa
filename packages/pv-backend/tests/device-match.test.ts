import { describe, expect, it } from "vitest";
import { findDeviceInPhrase, tokenise } from "../src/domain/device-match";

/**
 * A catalogue shaped like a real one: two brands, overlapping model names, and a
 * pair that differ only by a suffix. Those last two are the cases that break a
 * naive substring match, so they are here on purpose.
 */
const devices = [
  { slug: "iphone-13", name: "iPhone 13", brandName: "Apple" },
  { slug: "iphone-13-pro", name: "iPhone 13 Pro", brandName: "Apple" },
  { slug: "iphone-15-pro-max", name: "iPhone 15 Pro Max", brandName: "Apple" },
  { slug: "galaxy-a5", name: "Galaxy A5", brandName: "Samsung" },
  { slug: "galaxy-a54", name: "Galaxy A54", brandName: "Samsung" },
  { slug: "galaxy-s23-ultra", name: "Galaxy S23 Ultra", brandName: "Samsung" },
];

describe("tokenise", () => {
  it("splits a glued model name at the letter/digit boundary", () => {
    expect(tokenise("iphone13")).toEqual(["iphone", "13"]);
    expect(tokenise("iPhone 13")).toEqual(["iphone", "13"]);
  });

  it("treats punctuation as a break", () => {
    expect(tokenise("Galaxy S23+ Ultra")).toEqual(["galaxy", "s", "23", "ultra"]);
  });

  it("is empty for a string with nothing in it", () => {
    expect(tokenise("   -- ")).toEqual([]);
  });
});

describe("findDeviceInPhrase", () => {
  it("finds the model inside a real shopping query", () => {
    expect(findDeviceInPhrase("clear case for iphone 13", devices)?.slug).toBe("iphone-13");
  });

  it("prefers the more specific model when the query names it", () => {
    expect(findDeviceInPhrase("rugged case iphone 13 pro", devices)?.slug).toBe("iphone-13-pro");
  });

  /**
   * The case that a substring match gets wrong. "a54" must not be read as the
   * A5, or a shopper is quietly shown accessories for the wrong phone.
   */
  it("does not read a shorter model out of a longer one", () => {
    expect(findDeviceInPhrase("galaxy a54 pouch", devices)?.slug).toBe("galaxy-a54");
  });

  it("recognises a model glued to the rest of the query", () => {
    expect(findDeviceInPhrase("iphone13 case", devices)?.slug).toBe("iphone-13");
  });

  it("finds nothing in a query that names no device", () => {
    expect(findDeviceInPhrase("leather pouch", devices)).toBeNull();
    expect(findDeviceInPhrase("", devices)).toBeNull();
  });

  /**
   * A one-word model is too weak to recognise on its own — half the queries in a
   * case shop contain "pro" — so it only counts when the brand is named too.
   */
  it("requires the brand before trusting a one-word model name", () => {
    const oneWord = [{ slug: "pixel", name: "Pixel", brandName: "Google" }];
    expect(findDeviceInPhrase("pro case", oneWord)).toBeNull();
    expect(findDeviceInPhrase("pixel case", oneWord)).toBeNull();
    expect(findDeviceInPhrase("google pixel case", oneWord)?.slug).toBe("pixel");
  });
});
