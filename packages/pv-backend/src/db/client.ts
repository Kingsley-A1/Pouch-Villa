import { Pool, type PoolClient, type QueryResultRow } from "pg";

/**
 * CockroachDB speaks the Postgres wire protocol but is a distributed database. Two
 * consequences shape everything here:
 *
 *   - Latency is per-statement and across nodes, so one round trip beats several.
 *   - The server can abort a transaction and ask the client to retry it. That is
 *     normal operation, not an error, and every transaction must handle it.
 *
 * There is deliberately no fallback connection. A missing or unreachable database
 * fails loudly at the boundary; the prototype's silent drop to an in-memory store
 * looked healthy while quietly discarding every write.
 */

let pool: Pool | null = null;

export class DatabaseNotConfiguredError extends Error {
  constructor() {
    super(
      "DATABASE_URL is not configured. Set a CockroachDB connection string; there is no local fallback.",
    );
    this.name = "DatabaseNotConfiguredError";
  }
}

function connectionString() {
  const configured = process.env.DATABASE_URL?.trim();
  if (!configured) throw new DatabaseNotConfiguredError();
  return configured;
}

export function getPool(): Pool {
  if (pool) return pool;
  pool = new Pool({
    connectionString: connectionString(),
    max: Number(process.env.DATABASE_POOL_MAX ?? 10),
    idleTimeoutMillis: 30_000,
    // A serverless CockroachDB cluster resumes from cold on the first connection
    // after an idle period, which has taken well over ten seconds.
    connectionTimeoutMillis: Number(process.env.DATABASE_CONNECT_TIMEOUT_MS ?? 30_000),
    // Managed CockroachDB requires TLS. Certificate verification stays on.
    application_name: "pouch-villa",
  });
  pool.on("error", (error) => {
    console.error("Idle database client error", { message: error.message });
  });
  return pool;
}

export async function closePool() {
  if (!pool) return;
  const closing = pool;
  pool = null;
  await closing.end();
}

/** CockroachDB signals a retryable transaction conflict with SQLSTATE 40001. */
const RETRYABLE_SQLSTATE = new Set(["40001", "40003", "08006", "08003", "57P01"]);

export function isRetryable(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" && RETRYABLE_SQLSTATE.has(code);
}

/**
 * Socket-level failures, which carry no SQLSTATE at all.
 *
 * A managed CockroachDB cluster culls idle connections and refuses new ones once
 * its ceiling is reached, so `pg` raises a plain `Error("Connection terminated
 * unexpectedly")` with **no `code` property**, or a Node syscall error like
 * `ECONNRESET`. `isRetryable` reads a SQLSTATE and therefore classifies every one
 * of these as fatal, which is why a transient blip surfaced as a failed request
 * rather than a retried one.
 *
 * Kept separate from `isRetryable` deliberately: a server-signalled abort (40001)
 * means the transaction definitively did not commit, whereas losing the socket
 * can be ambiguous. Only callers that know no work has begun may treat these as
 * retryable — see `withTransaction`.
 */
const RETRYABLE_SYSCALLS = new Set([
  "ECONNRESET",
  "ECONNREFUSED",
  "ETIMEDOUT",
  "EPIPE",
  "EHOSTUNREACH",
]);

export function isConnectionError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const code = (error as { code?: unknown }).code;
  if (typeof code === "string" && RETRYABLE_SYSCALLS.has(code)) return true;
  const message = (error as { message?: unknown }).message;
  return (
    typeof message === "string" && /Connection terminated|Client has encountered/i.test(message)
  );
}

export type Queryable = Pick<PoolClient, "query">;

export async function query<Row extends QueryResultRow>(
  text: string,
  values: readonly unknown[] = [],
): Promise<Row[]> {
  const result = await getPool().query<Row>(text, values as unknown[]);
  return result.rows;
}

export async function queryOne<Row extends QueryResultRow>(
  text: string,
  values: readonly unknown[] = [],
): Promise<Row | null> {
  const rows = await query<Row>(text, values);
  return rows[0] ?? null;
}
