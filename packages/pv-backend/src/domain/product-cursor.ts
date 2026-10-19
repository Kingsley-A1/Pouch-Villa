/**
 * The opaque "where was I" token for a product list.
 *
 * A client never builds one, reads one, or does arithmetic on one — it hands back
 * whatever the previous page gave it. That is why it is encoded rather than
 * exposed as `?after=<id>`: the moment a position is legible somebody starts
 * constructing them, and then the sort order can never change.
 *
 * Two shapes, because the two lists are ordered by different things.
 *
 *   * **Browse** is newest first, so the position is the last row's sort key and
 *     id. A keyset position cannot skip or repeat a product when one is published
 *     while a shopper is reading; an offset can.
 *   * **Search** is ordered by relevance, a computed score with no stable value
 *     to resume from. The position there is an offset into a deterministic
 *     ordering (score, then id). A product published mid-search can shift it by
 *     one row; for a search that is the right trade against re-deriving a float
 *     score on every request.
 */

export type ProductCursor =
  { kind: "browse"; sortedAt: string; id: string } | { kind: "search"; offset: number };

const TIMESTAMP = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}(:?\d{2})?)$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Far beyond any catalogue this shop will hold; stops a hostile offset reaching SQL. */
const MAX_SEARCH_OFFSET = 10_000;

export function encodeProductCursor(cursor: ProductCursor): string {
  const payload =
    cursor.kind === "browse"
      ? { k: "b", t: cursor.sortedAt, i: cursor.id }
      : { k: "s", o: cursor.offset };
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

/**
 * Returns `null` for anything that is not a cursor this module produced.
 *
 * Every field is re-validated, because a cursor is a value that arrives from the
 * network and ends up as a query parameter: it must be shaped like a timestamp
 * and a UUID, or like a bounded integer, before it goes anywhere near SQL.
 */
export function decodeProductCursor(token: string): ProductCursor | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(token, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const fields = parsed as Record<string, unknown>;

  if (fields.k === "b" && typeof fields.t === "string" && typeof fields.i === "string") {
    if (!TIMESTAMP.test(fields.t) || !UUID.test(fields.i)) return null;
    return { kind: "browse", sortedAt: fields.t, id: fields.i };
  }
  if (fields.k === "s" && typeof fields.o === "number") {
    const offset = fields.o;
    if (!Number.isInteger(offset) || offset < 1 || offset > MAX_SEARCH_OFFSET) return null;
    return { kind: "search", offset };
  }
  return null;
}
