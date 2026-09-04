/**
 * Splits a SQL script into the individual statements it contains.
 *
 * This exists because of how the wire protocol treats a multi-statement string.
 * `client.query("A; B; C")` is one simple-query message, and the server runs it
 * as a single implicit transaction — which CockroachDB will not accept when the
 * statements mix a schema change with writes to the table it changed. Splitting
 * first is what gives each statement its own transaction.
 *
 * A naive `split(";")` cannot do this. A semicolon inside a string literal, a
 * quoted identifier, a comment or a dollar-quoted body is data, not a boundary,
 * and cutting there produces two fragments that are each a syntax error. None of
 * the migrations checked in today contain one — but a splitter that is only
 * correct for the SQL already written is a trap for whoever writes the next
 * migration, because it fails by silently corrupting the statement rather than
 * by refusing to run.
 */

/** `$$`, or a tagged `$name$`. Sticky so it anchors at the scan position. */
const DOLLAR_TAG = /\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/y;

function dollarTagAt(sql: string, index: number): string | null {
  DOLLAR_TAG.lastIndex = index;
  const match = DOLLAR_TAG.exec(sql);
  return match === null ? null : match[0];
}

/**
 * The index just past the closing quote.
 *
 * A doubled quote is an escaped quote in both string literals and quoted
 * identifiers, so it continues the literal rather than closing it. Backslashes
 * are ordinary characters under `standard_conforming_strings`, which is on by
 * default and which neither Postgres nor CockroachDB lets a migration change
 * behind our back.
 */
function endOfQuoted(sql: string, openIndex: number, quote: string): number {
  let index = openIndex + 1;
  while (index < sql.length) {
    if (sql[index] === quote) {
      if (sql[index + 1] === quote) {
        index += 2;
        continue;
      }
      return index + 1;
    }
    index += 1;
  }
  return index;
}

export function splitStatements(sql: string): string[] {
  const statements: string[] = [];
  let start = 0;
  let index = 0;
  /**
   * Whether anything executable has been seen since the last boundary.
   *
   * A trailing newline after the final semicolon, and a file whose tail is a
   * comment, both leave a fragment that is not a statement. Sending one is an
   * empty query — harmless on its own, but it would make the statement numbers
   * in a failure message disagree with the file a reader is looking at.
   */
  let sawCode = false;

  const flush = (end: number) => {
    if (sawCode) statements.push(sql.slice(start, end).trim());
    sawCode = false;
  };

  while (index < sql.length) {
    const character = sql[index];

    if (character === "-" && sql[index + 1] === "-") {
      const lineEnd = sql.indexOf("\n", index);
      index = lineEnd === -1 ? sql.length : lineEnd + 1;
      continue;
    }

    if (character === "/" && sql[index + 1] === "*") {
      const commentEnd = sql.indexOf("*/", index + 2);
      index = commentEnd === -1 ? sql.length : commentEnd + 2;
      continue;
    }

    if (character === "'" || character === '"') {
      index = endOfQuoted(sql, index, character);
      sawCode = true;
      continue;
    }

    const tag = dollarTagAt(sql, index);
    if (tag !== null) {
      const bodyEnd = sql.indexOf(tag, index + tag.length);
      index = bodyEnd === -1 ? sql.length : bodyEnd + tag.length;
      sawCode = true;
      continue;
    }

    if (character === ";") {
      flush(index);
      index += 1;
      start = index;
      continue;
    }

    if (character !== undefined && !/\s/.test(character)) sawCode = true;
    index += 1;
  }

  // A final statement need not be terminated; the end of the file ends it.
  flush(sql.length);

  return statements;
}
