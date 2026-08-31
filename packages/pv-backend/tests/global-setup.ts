import { resolve } from "node:path";
import { loadEnvFiles } from "../src/env";

/**
 * Runs once before any test file. A CockroachDB Serverless cluster that has been
 * idle can take well over the per-test timeout to accept its first connection;
 * without this, that cold-start cost lands on whichever test happens to run
 * first and fails it with an unrelated-looking timeout. Paying it once, here,
 * with a timeout generous enough to absorb a real cold start, means every actual
 * test only ever sees an already-warm pool.
 */
export default async function globalSetup() {
  loadEnvFiles(resolve(process.cwd(), "../.."));
  loadEnvFiles(process.cwd());
  if (!process.env.DATABASE_URL?.trim() && !process.env.TEST_DATABASE_URL?.trim()) return;

  const { Pool } = await import("pg");
  const connectionString =
    process.env.TEST_DATABASE_URL?.trim() || process.env.DATABASE_URL!.trim();
  const pool = new Pool({ connectionString, connectionTimeoutMillis: 60_000, max: 1 });
  try {
    await pool.query("SELECT 1");
  } finally {
    await pool.end();
  }
}
