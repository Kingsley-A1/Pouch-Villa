import { describe, expect, it } from "vitest";
import { decodeProductCursor, encodeProductCursor } from "../src/domain/product-cursor";

const UUID = "3f2b8a52-8f0a-4b9e-9c7e-1d2f3a4b5c6d";

describe("product cursor", () => {
  it("round-trips a browse position exactly, microseconds included", () => {
    const cursor = {
      kind: "browse",
      sortedAt: "2026-10-19 07:55:00.123456+00:00",
      id: UUID,
    } as const;
    expect(decodeProductCursor(encodeProductCursor(cursor))).toEqual(cursor);
  });

  it("round-trips a search position", () => {
    const cursor = { kind: "search", offset: 48 } as const;
    expect(decodeProductCursor(encodeProductCursor(cursor))).toEqual(cursor);
  });

  it("is safe to put in a URL", () => {
    const token = encodeProductCursor({
      kind: "browse",
      sortedAt: "2026-10-19 07:55:00+00",
      id: UUID,
    });
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  const encode = (payload: unknown) => Buffer.from(JSON.stringify(payload)).toString("base64url");

  it.each([
    ["garbage", "not a cursor"],
    ["empty", ""],
    ["not json", Buffer.from("{oops").toString("base64url")],
    ["a bare number", encode(7)],
    ["an unknown kind", encode({ k: "x", o: 3 })],
    [
      "a browse position with a SQL-shaped timestamp",
      encode({ k: "b", t: "now(); DROP TABLE product", i: UUID }),
    ],
    [
      "a browse position with a non-UUID id",
      encode({ k: "b", t: "2026-10-19 07:55:00+00", i: "1 OR 1=1" }),
    ],
    ["a negative search offset", encode({ k: "s", o: -1 })],
    ["a zero search offset", encode({ k: "s", o: 0 })],
    ["a fractional search offset", encode({ k: "s", o: 1.5 })],
    ["an enormous search offset", encode({ k: "s", o: 1e9 })],
    ["a string search offset", encode({ k: "s", o: "5" })],
  ])("rejects %s", (_label, token) => {
    expect(decodeProductCursor(token)).toBeNull();
  });
});
