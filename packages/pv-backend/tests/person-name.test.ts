import { describe, expect, it } from "vitest";
import { displayName, firstName, greetingName, initials } from "../src/domain/person-name";

/**
 * These four functions decide what a customer is called on every screen of their
 * account, from one free-text field they typed themselves. The cases that matter
 * are the messy ones — a blank name, a single word, stray whitespace, an account
 * created through Google with no name at all — because each of those renders as
 * an empty greeting if it is not handled here.
 */
describe("displayName", () => {
  it("returns the stored name, with runs of whitespace collapsed", () => {
    expect(displayName("  Ada   Nnamdi Obi ")).toBe("Ada Nnamdi Obi");
  });

  it("treats a missing or blank name as no name at all", () => {
    expect(displayName(null)).toBeNull();
    expect(displayName("   ")).toBeNull();
  });
});

describe("firstName", () => {
  it("takes the word the person chose to lead with", () => {
    expect(firstName("Ada Nnamdi Obi")).toBe("Ada");
  });

  it("greets a one-word name as itself", () => {
    expect(firstName("Ada")).toBe("Ada");
  });

  it("is null when there is no name", () => {
    expect(firstName(null)).toBeNull();
  });
});

describe("greetingName", () => {
  it("prefers the stored name over the email", () => {
    expect(greetingName("Ada Obi", "someone@example.com")).toBe("Ada");
  });

  it("falls back to the local part when no name was given", () => {
    expect(greetingName(null, "ada.obi@example.com")).toBe("ada.obi");
  });

  it("caps a long local part so a heading cannot overflow a 360px screen", () => {
    const long = `${"a".repeat(40)}@example.com`;
    expect(greetingName(null, long)).toHaveLength(24);
  });

  it("is null when neither a name nor a usable address exists", () => {
    expect(greetingName(null, "@example.com")).toBeNull();
  });
});

describe("initials", () => {
  it("uses the first and last words of a full name", () => {
    expect(initials("Ada Nnamdi Obi", "ada@example.com")).toBe("AO");
  });

  it("uses one letter for a one-word name", () => {
    expect(initials("Ada", "ada@example.com")).toBe("A");
  });

  it("falls back to the email for an account created through Google with no name", () => {
    expect(initials(null, "kingsley@example.com")).toBe("K");
  });

  it("ignores a name made only of punctuation rather than drawing it", () => {
    expect(initials("--", "kingsley@example.com")).toBe("K");
  });
});
