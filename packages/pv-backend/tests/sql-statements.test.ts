import { describe, expect, it } from "vitest";
import { splitStatements } from "../src/db/sql-statements";

/**
 * The splitter is what stops a migration file being sent as one implicit
 * transaction, so its failure mode matters more than most: cutting a statement
 * in the wrong place does not throw, it produces two fragments that are each a
 * syntax error, and the migration that reports it is not the one at fault.
 *
 * Every case below is a place a naive `split(";")` gets it wrong.
 */
describe("splitStatements", () => {
  it("splits a script into its statements and drops the terminators", () => {
    expect(splitStatements("SELECT 1; SELECT 2;")).toEqual(["SELECT 1", "SELECT 2"]);
  });

  it("does not need the last statement to be terminated", () => {
    expect(splitStatements("SELECT 1;\nSELECT 2")).toEqual(["SELECT 1", "SELECT 2"]);
  });

  it("keeps a semicolon inside a string literal", () => {
    expect(splitStatements("INSERT INTO t VALUES ('a; b'); SELECT 1;")).toEqual([
      "INSERT INTO t VALUES ('a; b')",
      "SELECT 1",
    ]);
  });

  it("treats a doubled quote as an escape rather than the end of the literal", () => {
    expect(splitStatements("SELECT 'it''s; fine'; SELECT 2;")).toEqual([
      "SELECT 'it''s; fine'",
      "SELECT 2",
    ]);
  });

  it("keeps a semicolon inside a quoted identifier", () => {
    expect(splitStatements('SELECT "odd;name" FROM t; SELECT 2;')).toEqual([
      'SELECT "odd;name" FROM t',
      "SELECT 2",
    ]);
  });

  it("keeps a semicolon inside a line comment", () => {
    expect(splitStatements("SELECT 1 -- not; a boundary\n + 1;")).toEqual([
      "SELECT 1 -- not; a boundary\n + 1",
    ]);
  });

  it("keeps a semicolon inside a block comment", () => {
    expect(splitStatements("SELECT /* not; here */ 1; SELECT 2;")).toEqual([
      "SELECT /* not; here */ 1",
      "SELECT 2",
    ]);
  });

  it("keeps a semicolon inside a dollar-quoted body", () => {
    expect(splitStatements("CREATE FUNCTION f() AS $$ SELECT 1; $$; SELECT 2;")).toEqual([
      "CREATE FUNCTION f() AS $$ SELECT 1; $$",
      "SELECT 2",
    ]);
  });

  it("respects a tagged dollar quote, including a nested plain one", () => {
    expect(splitStatements("SELECT $tag$ a; $$ b; $tag$; SELECT 2;")).toEqual([
      "SELECT $tag$ a; $$ b; $tag$",
      "SELECT 2",
    ]);
  });

  it("does not mistake a bind placeholder for a dollar quote", () => {
    // `$1` is not an opening tag. Reading it as one would swallow the rest of
    // the file into a string that never closes.
    expect(splitStatements("INSERT INTO t VALUES ($1, $2); SELECT 3;")).toEqual([
      "INSERT INTO t VALUES ($1, $2)",
      "SELECT 3",
    ]);
  });

  it("produces nothing for a script that has no statements in it", () => {
    expect(splitStatements("")).toEqual([]);
    expect(splitStatements("\n\n  \n")).toEqual([]);
    expect(splitStatements("-- just a comment\n/* and another */\n")).toEqual([]);
  });

  it("drops the empty fragment after a trailing semicolon and newline", () => {
    // The shape every migration file ends with. Sending the tail would be an
    // empty query, and would make statement numbers disagree with the file.
    expect(splitStatements("SELECT 1;\n")).toEqual(["SELECT 1"]);
    expect(splitStatements("SELECT 1;\n-- closing note\n")).toEqual(["SELECT 1"]);
  });

  it("ignores a repeated terminator rather than emitting a blank statement", () => {
    expect(splitStatements("SELECT 1;; SELECT 2;")).toEqual(["SELECT 1", "SELECT 2"]);
  });

  it("keeps the comment that introduces a statement attached to it", () => {
    // The comment says why the statement exists; a failure message that quotes
    // the statement without it is harder to act on, not easier.
    expect(splitStatements("-- why\nCREATE TABLE t (id INT);")).toEqual([
      "-- why\nCREATE TABLE t (id INT)",
    ]);
  });

  it("preserves order", () => {
    const script = "CREATE TABLE t (id INT); CREATE INDEX i ON t (id); INSERT INTO t VALUES (1);";
    expect(splitStatements(script).map((statement) => statement.split(" ")[1])).toEqual([
      "TABLE",
      "INDEX",
      "INTO",
    ]);
  });

  it("does not hang on an unterminated literal", () => {
    // Malformed input is the server's to reject, and it must reach the server
    // intact to be rejected with a real syntax error rather than being silently
    // swallowed here. What must not happen is the scanner running past the end
    // of the file.
    expect(splitStatements("SELECT 'unclosed")).toEqual(["SELECT 'unclosed"]);
    expect(splitStatements("SELECT /* unclosed")).toEqual(["SELECT /* unclosed"]);
    // Nothing executable precedes the unclosed comment here, so there is no
    // statement to send.
    expect(splitStatements("/* unclosed")).toEqual([]);
  });
});
