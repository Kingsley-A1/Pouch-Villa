import type { PoolClient } from "pg";
import { getPool, isConnectionError, isRetryable, type Queryable } from "./client";

export const MAX_TRANSACTION_ATTEMPTS = 5;

const BASE_BACKOFF_MS = 20;
const MAX_BACKOFF_MS = 500;

/** Full jitter, so retrying clients do not resynchronise into a second collision. */
export function backoffDelayMs(attempt: number, random: () => number = Math.random) {
  const ceiling = Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * 2 ** (attempt - 1));
  return Math.round(random() * ceiling);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class TransactionRetryLimitError extends Error {
  constructor(
    readonly attempts: number,
    readonly lastError: unknown,
  ) {
    super(`Transaction still conflicting after ${attempts} attempts.`);
    this.name = "TransactionRetryLimitError";
  }
}

/**
 * Runs `work` inside a transaction, retrying when CockroachDB aborts it.
 *
 * A connection lost *during* the body is deliberately **not** retried here. It
 * would need a fresh client, and — if the socket died while COMMIT was in
 * flight — whether the work landed is genuinely unknowable from this side, so
 * silently replaying it could double-apply. Order placement is protected from
 * that by its idempotency key; anything else surfaces the error rather than
 * guessing. See docs/work-plan.md §6.
 *
 * **The body must be safe to run more than once.** A retry re-executes it from the
 * start, so anything with an effect outside the transaction — sending an email,
 * charging a card, writing to R2, incrementing a counter held in memory — belongs
 * after the transaction commits, never inside it.
 */
/**
 * Acquires a pooled connection, retrying a transient failure to get one.
 *
 * This is separate from the transaction retry below, and the distinction is the
 * whole point: **nothing has been executed yet**, so retrying is unambiguously
 * safe — there is no possibility that work was applied and the acknowledgement
 * lost. A managed CockroachDB cluster refuses connections whenever it is at its
 * ceiling or resuming from cold, and previously a single such blip failed the
 * caller outright because acquisition sat outside every retry path.
 */
const CONNECT_ATTEMPTS = 3;

/**
 * Whether a failed acquisition is worth immediately trying again.
 *
 * **A timeout is not.** `connectionTimeoutMillis` is 30s, so a retry after
 * ETIMEDOUT costs another full 30s to learn the same thing — the server has
 * already proved unresponsive for the whole window, and retrying multiplies the
 * latency budget without improving the odds. Retrying timeouts here turned a
 * ten-minute test run into forty and pushed individual cases past their own
 * timeout, which is how this was found.
 *
 * A *refused* or *reset* connection is different: it fails in milliseconds and
 * usually means a momentarily full pool on the cluster side, which a short
 * backoff genuinely clears.
 */
function worthReconnecting(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code;
  if (code === "ETIMEDOUT") return false;
  return isConnectionError(error) || isRetryable(error);
}

async function connectWithRetry(): Promise<PoolClient> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= CONNECT_ATTEMPTS; attempt += 1) {
    try {
      return await getPool().connect();
    } catch (error) {
      if (!worthReconnecting(error)) throw error;
      lastError = error;
      if (attempt < CONNECT_ATTEMPTS) await sleep(backoffDelayMs(attempt));
    }
  }
  throw new TransactionRetryLimitError(CONNECT_ATTEMPTS, lastError);
}

export async function withTransaction<T>(
  work: (tx: Queryable) => Promise<T>,
  { maxAttempts = MAX_TRANSACTION_ATTEMPTS }: { maxAttempts?: number } = {},
): Promise<T> {
  const client: PoolClient = await connectWithRetry();

  /**
   * A checked-out client whose socket dies emits `'error'`, and an EventEmitter
   * error with no listener becomes an **uncaught exception** — which in a
   * request handler is far worse than the failed query it accompanies.
   *
   * `getPool().on("error")` does not cover this: that handles *idle* clients
   * still in the pool. Between checkout and release, this listener is the only
   * thing standing between a dropped connection and a process-level crash. The
   * awaited query rejects as normal, so the caller still sees the real error
   * through the promise; this only stops the duplicate event from escaping.
   */
  const swallowSocketError = (error: Error) => {
    console.error("Pooled client error during transaction", { message: error.message });
  };
  client.on("error", swallowSocketError);

  try {
    let lastError: unknown;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        await client.query("BEGIN");
        const result = await work(client);
        await client.query("COMMIT");
        return result;
      } catch (error) {
        await client.query("ROLLBACK").catch(() => {});
        if (!isRetryable(error)) throw error;
        lastError = error;
        if (attempt < maxAttempts) await sleep(backoffDelayMs(attempt));
      }
    }
    throw new TransactionRetryLimitError(maxAttempts, lastError);
  } finally {
    client.off("error", swallowSocketError);
    client.release();
  }
}
