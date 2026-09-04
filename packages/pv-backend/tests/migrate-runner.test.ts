import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * A pool that records what it was asked to run, so the runner can be tested
 * without a database. The shape is only what `migrate()` actually touches.
 */
const issued: string[] = [];
let failOn: ((sql: string) => Error | null) | null = null;

const client = {
  query: vi.fn(async (sql: string) => {
    issued.push(sql);
    const failure = failOn?.(sql) ?? null;
    if (failure !== null) throw failure;
    return { rows: [], rowCount: 0 };
  }),
  release: vi.fn(),
};

vi.mock("../src/db/client", () => ({
  getPool: () => ({
    query: async (sql: string) => {
      issued.push(sql);
      return { rows: [], rowCount: 0 };
    },
    connect: async () => client,
  }),
}));

const { migrate, MigrationStatementError } = await import("../src/db/migrate");

async function migrationDir(contents: string, name = "0001_example.sql") {
  const dir = await mkdtemp(join(tmpdir(), "pv-migrations-"));
  await writeFile(join(dir, name), contents);
  return dir;
}

/** Just the statements that came from a migration file. */
function fileStatements() {
  return issued.filter(
    (sql) => !sql.includes("schema_migration") && !sql.startsWith("SELECT name, checksum"),
  );
}

/**
 * The CI failure this test exists for.
 *
 * `0008_admin_search.sql` creates `admin_search_document`, adds three indexes to
 * it, then fills it from the canonical tables. The runner passed the whole file
 * to `client.query`, which is one simple-query message and therefore one
 * implicit transaction — and CockroachDB will not accept a write to a table that
 * a schema change earlier in the same transaction is still adding. Every run
 * against a fresh database died with `table "admin_search_document" is being
 * added`, which is why the Performance budgets job never reached Lighthouse.
 *
 * `0001` and `0003` create a table and insert into it too, and they pass,
 * because neither adds an index in between. That difference is what identifies
 * the cause: the transaction, not the SQL.
 */
describe("the migration runner", () => {
  afterEach(() => {
    issued.length = 0;
    failOn = null;
    vi.clearAllMocks();
  });

  it("sends each statement as its own query, not the file as one", async () => {
    const dir = await migrationDir(
      [
        "CREATE TABLE IF NOT EXISTS thing (id UUID PRIMARY KEY);",
        "CREATE INDEX IF NOT EXISTS thing_idx ON thing (id);",
        "INSERT INTO thing (id) SELECT id FROM other ON CONFLICT DO NOTHING;",
      ].join("\n"),
    );

    const result = await migrate({ dir });

    expect(result.applied).toEqual(["0001_example.sql"]);
    const statements = fileStatements();
    expect(statements).toHaveLength(3);
    expect(statements[0]).toMatch(/^CREATE TABLE/);
    expect(statements[1]).toMatch(/^CREATE INDEX/);
    expect(statements[2]).toMatch(/^INSERT INTO/);
    // The specific thing that was wrong: no single query carries the schema
    // change and the write together.
    for (const statement of statements) {
      expect(/^(?:CREATE|ALTER)\b/i.test(statement) && /INSERT\s+INTO/i.test(statement)).toBe(
        false,
      );
    }
  });

  it("records the migration only after every statement has run", async () => {
    const dir = await migrationDir(
      "CREATE TABLE IF NOT EXISTS a (id INT);\nINSERT INTO a VALUES (1) ON CONFLICT DO NOTHING;",
    );

    await migrate({ dir });

    const ledgerIndex = issued.findIndex((sql) => sql.startsWith("INSERT INTO schema_migration"));
    const lastStatement = issued.findIndex((sql) => sql.startsWith("INSERT INTO a"));
    expect(ledgerIndex).toBeGreaterThan(lastStatement);
  });

  it("names the file and the statement when one fails", async () => {
    const dir = await migrationDir(
      [
        "CREATE TABLE IF NOT EXISTS admin_search_document (id INT);",
        "CREATE INDEX IF NOT EXISTS d_idx ON admin_search_document (id);",
        "INSERT INTO admin_search_document VALUES (1) ON CONFLICT DO NOTHING;",
      ].join("\n"),
      "0008_admin_search.sql",
    );
    failOn = (sql) =>
      sql.startsWith("INSERT INTO admin_search_document")
        ? new Error('table "admin_search_document" is being added')
        : null;

    // Before this change the driver error arrived bare, and the CI log was one
    // line that named neither the migration nor the statement.
    await expect(migrate({ dir })).rejects.toThrow(MigrationStatementError);
    await expect(migrate({ dir })).rejects.toThrow(
      /0008_admin_search\.sql failed at statement 3.*is being added/s,
    );
  });

  it("does not record a migration that failed part-way", async () => {
    const dir = await migrationDir(
      "CREATE TABLE IF NOT EXISTS a (id INT);\nCREATE TABLE IF NOT EXISTS b (id INT);",
    );
    failOn = (sql) => (sql.includes("b (id INT)") ? new Error("boom") : null);

    await expect(migrate({ dir })).rejects.toThrow(/failed at statement 2/);
    expect(issued.some((sql) => sql.startsWith("INSERT INTO schema_migration"))).toBe(false);
  });

  it("releases the connection even when a statement throws", async () => {
    const dir = await migrationDir("CREATE TABLE IF NOT EXISTS a (id INT);");
    failOn = () => new Error("boom");

    await expect(migrate({ dir })).rejects.toThrow();
    expect(client.release).toHaveBeenCalledTimes(1);
  });
});
