// @vitest-environment node
import { describe, expect, it } from "vitest";
import { can } from "../src/auth/permissions";

describe("server role permissions", () => {
  it("allows owners to manage staff", () => {
    expect(can("owner", "staff")).toBe(true);
  });
  it("prevents catalogue staff from managing reservations", () => {
    expect(can("catalogue", "reservations")).toBe(false);
  });
  it("limits viewers to read-oriented areas", () => {
    expect(can("viewer", "products")).toBe(false);
    expect(can("viewer", "analytics")).toBe(true);
  });
});
