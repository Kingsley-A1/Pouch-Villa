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
async function connectWithRetry(maxAttempts: number): Promise<PoolClient> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await getPool().connect();
    } catch (error) {
      if (!isConnectionError(error) && !isRetryable(error)) throw error;
      lastError = error;
      if (attempt < maxAttempts) await sleep(backoffDelayMs(attempt));
    }
  }
  throw new TransactionRetryLimitError(maxAttempts, lastError);
}

export async function withTransaction<T>(
  work: (tx: Queryable) => Promise<T>,
  { maxAttempts = MAX_TRANSACTION_ATTEMPTS }: { maxAttempts?: number } = {},
): Promise<T> {
  const client: PoolClient = await connectWithRetry(maxAttempts);
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
    client.release();
  }
}
