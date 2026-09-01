import { describe, expect, it } from "vitest";
import { normalizeAdminSearchInput, searchAdmin } from "../src/services/admin-search";

describe("normalizeAdminSearchInput", () => {
  it("prevents a one-character query from reaching the database", () => {
    expect(normalizeAdminSearchInput({ query: "  a  " })).toBeNull();
  });

  it("normalizes whitespace and clamps the requested result limit", () => {
    expect(normalizeAdminSearchInput({ query: "  phone    case  ", limit: 200 })).toEqual({
      query: "phone case",
      limit: 20,
    });
  });

  it("uses a positive integer limit", () => {
    expect(normalizeAdminSearchInput({ query: "order", limit: -4 })).toEqual({
      query: "order",
      limit: 1,
    });
    expect(normalizeAdminSearchInput({ query: "order", limit: 7.8 })).toEqual({
      query: "order",
      limit: 7,
    });
  });
});

describe("searchAdmin", () => {
  it("returns no records for a short query without requiring a database", async () => {
    await expect(searchAdmin("staff-id", { query: "x" })).resolves.toEqual([]);
  });
});
