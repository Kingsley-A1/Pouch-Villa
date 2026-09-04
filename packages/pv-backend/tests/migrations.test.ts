import { describe, expect, it } from "vitest";
import { at, must } from "../src/domain/assert";
import { loadMigrations } from "../src/db/migrate";
import { splitStatements } from "../src/db/sql-statements";

const files = await loadMigrations();

/** A statement with its leading comments removed, for matching against. */
function code(statement: string): string {
  return statement
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n")
    .trim();
}

/**
 * The shapes that survive being run a second time.
 *
 * A migration file is not atomic — see the note in `migrate.ts`. A failure
 * part-way through leaves the statements before it applied and writes no ledger
 * row, so the next run replays them. Every statement therefore has to be safe to
 * run twice, or the first failure inside a file wedges that database for good.
 */
const REPLAY_SAFE = [
  /^CREATE\s+(?:UNIQUE\s+|INVERTED\s+)?(?:TABLE|INDEX|EXTENSION|VIEW|SEQUENCE|TYPE)\s+IF\s+NOT\s+EXISTS\b/i,
  /^ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?\S+\s+ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\b/i,
  /^ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?\S+\s+DROP\s+COLUMN\s+IF\s+EXISTS\b/i,
  /^ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?\S+\s+ALTER\s+COLUMN\b/i,
  /^INSERT\s+INTO\b[\s\S]*\bON\s+CONFLICT\b/i,
  /^DROP\s+\w+\s+IF\s+EXISTS\b/i,
];

/**
 * Two statements that predate this rule and cannot be brought under it.
 *
 * Neither Postgres nor CockroachDB accepts `ADD CONSTRAINT IF NOT EXISTS`, and
 * both files have already been applied to real databases — `migrate.ts` records
 * a checksum precisely so an applied migration cannot be edited, so the fix is
 * not to rewrite them.
 *
 * The residual risk is bounded and was checked rather than assumed. In
 * `0010_section_layout.sql` the statement is the last in the file, so nothing
 * after it can fail and trigger a replay. In `0006_commerce.sql` the three
 * statements that follow are all `IF NOT EXISTS`, so a replay would only be
 * reached through a deterministic failure in one of them — a bug caught on a
 * fresh database, not a hazard to a live one.
 *
 * Nothing may be added to this list. A new migration that needs a constraint
 * writes it into the `CREATE TABLE`.
 */
const GRANDFATHERED = new Set(["0006_commerce.sql::48", "0010_section_layout.sql::2"]);

describe("checked-in migrations", () => {
  it("has migrations to check", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it("names every file so lexical order is apply order", () => {
    for (const file of files) expect(file.name).toMatch(/^\d{4}_[a-z0-9_]+\.sql$/);

    const numbers = files.map((file) => file.name.slice(0, 4));
    expect(numbers).toEqual([...numbers].sort());
    expect(new Set(numbers).size).toBe(numbers.length);
  });

  it("splits every file into statements, none of them empty", () => {
    for (const file of files) {
      const statements = splitStatements(file.sql);
      expect(statements.length, `${file.name} produced no statements`).toBeGreaterThan(0);
      for (const statement of statements) {
        expect(code(statement), `${file.name} has an empty statement`).not.toBe("");
      }
    }
  });

  /**
   * The regression test for the CI failure.
   *
   * `0008_admin_search.sql` creates `admin_search_document`, adds three indexes
   * to it, then fills it from the canonical tables. Sent as one string that is
   * one implicit transaction, and CockroachDB rejects the writes with
   * `table "admin_search_document" is being added`, because a schema change
   * earlier in the same transaction still has the descriptor. Every statement
   * arriving on its own is what fixes it, so no single statement may carry both
   * a schema change and a write.
   */
  it("never puts a schema change and a write in the same statement", () => {
    for (const file of files) {
      for (const [offset, statement] of splitStatements(file.sql).entries()) {
        const body = code(statement);
        const changesSchema = /^(?:CREATE|ALTER|DROP)\b/i.test(body);
        const writes = /\b(?:INSERT\s+INTO|UPDATE\s+\w+\s+SET|DELETE\s+FROM|UPSERT)\b/i.test(body);
        expect(
          changesSchema && writes,
          `${file.name} statement ${offset + 1} mixes a schema change with a write`,
        ).toBe(false);
      }
    }
  });

  it("keeps every statement safe to run a second time", () => {
    const offenders: string[] = [];

    for (const file of files) {
      for (const [offset, statement] of splitStatements(file.sql).entries()) {
        const reference = `${file.name}::${offset + 1}`;
        if (GRANDFATHERED.has(reference)) continue;
        const body = code(statement);
        if (!REPLAY_SAFE.some((shape) => shape.test(body))) {
          offenders.push(`${reference}  ${body.replace(/\s+/g, " ").slice(0, 90)}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it("still covers the grandfathered statements, so the list cannot rot", () => {
    // If one of these files is renumbered or a statement is inserted above it,
    // the reference stops pointing at an `ADD CONSTRAINT` and the exemption is
    // silently protecting something else instead.
    for (const reference of GRANDFATHERED) {
      const parts = reference.split("::");
      const name = at(parts, 0);
      const position = Number(at(parts, 1));

      const file = must(
        files.find((candidate) => candidate.name === name),
        `${name}, which is exempted but no longer exists`,
      );
      const statement = at(splitStatements(file.sql), position - 1);

      expect(code(statement)).toMatch(/^ALTER\s+TABLE\b[\s\S]*\bADD\s+CONSTRAINT\b/i);
    }
  });
});
