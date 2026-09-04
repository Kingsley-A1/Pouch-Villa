import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { getPool } from "./client";
import { splitStatements } from "./sql-statements";

/**
 * Forward-only migrations. There is no `down`: a rollback in a distributed database
 * under load is how data gets lost. Correcting a migration means writing the next
 * one.
 *
 * Each applied file's checksum is recorded, so editing a migration that has already
 * run is caught rather than silently diverging environments.
 */

export const MIGRATIONS_DIR = fileURLToPath(new URL("../../migrations", import.meta.url));

const LEDGER = `
  CREATE TABLE IF NOT EXISTS schema_migration (
    name       STRING PRIMARY KEY,
    checksum   STRING NOT NULL,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )
`;

export function checksum(contents: string) {
  return createHash("sha256").update(contents.replace(/\r\n/g, "\n")).digest("hex");
}

export type MigrationFile = { name: string; sql: string; checksum: string };

export async function loadMigrations(dir = MIGRATIONS_DIR): Promise<MigrationFile[]> {
  const names = (await readdir(dir)).filter((name) => name.endsWith(".sql")).sort();
  const files: MigrationFile[] = [];
  for (const name of names) {
    const sql = await readFile(join(dir, name), "utf8");
    files.push({ name, sql, checksum: checksum(sql) });
  }
  return files;
}

export class MigrationChangedError extends Error {
  constructor(name: string) {
    super(
      `Migration ${name} has already been applied but its contents changed. Migrations are immutable once applied — write a new one instead.`,
    );
    this.name = "MigrationChangedError";
  }
}

/**
 * Which statement failed, and what it was.
 *
 * `scripts/migrate.ts` prints `error.message` alone, so a driver error arriving
 * bare — `table "admin_search_document" is being added` — named neither the file
 * nor the statement, and a reader had to guess from eleven migrations. The
 * position counts executable statements, so it matches what `splitStatements`
 * produced rather than the file's semicolons.
 */
export class MigrationStatementError extends Error {
  readonly migration: string;
  readonly position: number;
  readonly statement: string;

  constructor(migration: string, position: number, statement: string, cause: unknown) {
    const reason = cause instanceof Error ? cause.message : String(cause);
    super(`${migration} failed at statement ${position}: ${reason}\n\n${excerpt(statement)}`, {
      cause,
    });
    this.name = "MigrationStatementError";
    this.migration = migration;
    this.position = position;
    this.statement = statement;
  }
}

/** Enough of a statement to recognise it, without pasting a 40-line CREATE TABLE. */
function excerpt(statement: string): string {
  const code = statement
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n")
    .trim();
  return code.length > 200 ? `${code.slice(0, 200)}…` : code;
}

export async function migrate({ dir = MIGRATIONS_DIR }: { dir?: string } = {}) {
  const pool = getPool();
  await pool.query(LEDGER);

  const applied = new Map(
    (
      await pool.query<{ name: string; checksum: string }>(
        "SELECT name, checksum FROM schema_migration",
      )
    ).rows.map((row) => [row.name, row.checksum]),
  );

  const files = await loadMigrations(dir);
  const ran: string[] = [];

  for (const file of files) {
    const previous = applied.get(file.name);
    if (previous !== undefined) {
      if (previous !== file.checksum) throw new MigrationChangedError(file.name);
      continue;
    }

    const client = await pool.connect();
    try {
      /**
       * One statement per round trip, deliberately.
       *
       * Passing the whole file to `client.query` sends it as a single
       * simple-query message, which the server runs as one implicit
       * transaction — and CockroachDB will not accept DML against a table that
       * a schema change earlier in the same transaction is still adding.
       * `0008_admin_search.sql` creates a table, adds three indexes to it and
       * then fills it, which is exactly that shape, and it failed with
       * `table "admin_search_document" is being added` on every run against a
       * fresh database. `0001` and `0003` also create a table and insert into
       * it, and they pass, because neither adds an index in between.
       *
       * The cost is that a file is not atomic. That is closer to the truth than
       * the alternative — CockroachDB cannot roll back a completed schema change
       * anyway — but it does mean a failure part-way through leaves the earlier
       * statements applied and writes no ledger row, so the next run replays
       * them. Every statement must therefore be safe to run twice;
       * `tests/migrations.test.ts` holds the checked-in set to that.
       */
      const statements = splitStatements(file.sql);
      for (const [offset, statement] of statements.entries()) {
        try {
          await client.query(statement);
        } catch (cause) {
          throw new MigrationStatementError(file.name, offset + 1, statement, cause);
        }
      }

      await client.query("INSERT INTO schema_migration (name, checksum) VALUES ($1, $2)", [
        file.name,
        file.checksum,
      ]);
      ran.push(file.name);
    } finally {
      client.release();
    }
  }

  return { applied: ran, alreadyApplied: files.length - ran.length };
}
