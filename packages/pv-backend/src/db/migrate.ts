import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { getPool } from "./client";

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

    // Schema changes in CockroachDB are online and asynchronous, and several DDL
    // statements cannot share a transaction, so each file runs on its own and is
    // recorded only once it has completed.
    const client = await pool.connect();
    try {
      await client.query(file.sql);
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
