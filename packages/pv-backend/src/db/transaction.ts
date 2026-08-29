import type { PoolClient } from "pg";
import { getPool, isRetryable, type Queryable } from "./client";

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
 * **The body must be safe to run more than once.** A retry re-executes it from the
 * start, so anything with an effect outside the transaction — sending an email,
 * charging a card, writing to R2, incrementing a counter held in memory — belongs
 * after the transaction commits, never inside it.
 */
export async function withTransaction<T>(
  work: (tx: Queryable) => Promise<T>,
  { maxAttempts = MAX_TRANSACTION_ATTEMPTS }: { maxAttempts?: number } = {},
): Promise<T> {
  const client: PoolClient = await getPool().connect();
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
