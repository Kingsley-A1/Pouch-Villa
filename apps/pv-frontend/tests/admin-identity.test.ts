import { describe, expect, it } from "vitest";
import { initialsForName } from "@/lib/initials";

describe("admin avatar initials", () => {
  it("uses the first and last names and remains bounded to two letters", () => {
    expect(initialsForName("Kingsley Chukwuma Maduabuchi")).toBe("KM");
    expect(initialsForName("Ada")).toBe("A");
  });
});
