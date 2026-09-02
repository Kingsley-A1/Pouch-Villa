import { query, type Queryable } from "../db/client";

/**
 * Rate limiting for the paths AGENTS.md §5 names: authentication, password
 * reset, payment-proof upload and review submission. Per-IP **and** per-account,
 * because each alone leaves a hole — per-account misses an attacker spraying one
 * password across many addresses, and per-IP misses a distributed attempt on one
 * account.
 *
 * Staff login deliberately does not use this. It counts failures out of
 * `audit_event`, which is correct there because a staff login failure genuinely
 * is an auditable security event worth keeping forever. An anonymous review
 * submission is not: writing every one into the append-only audit trail would
 * bury the record staff actually read under noise from strangers. So these hits
 * live in their own table, which is also sweepable — the audit trail is not.
 *
 * This is a database-backed counter, not a token bucket in memory. Memory does
 * not survive a serverless instance recycling, and an attacker who can cause a
 * recycle can reset an in-memory limit.
 */

export const RATE_LIMITS = {
  "customer.login": { limit: 8, windowMinutes: 15 },
  "customer.signup": { limit: 5, windowMinutes: 60 },
  "customer.password_reset": { limit: 5, windowMinutes: 60 },
  "payment_proof.upload": { limit: 10, windowMinutes: 60 },
  "review.submit": { limit: 5, windowMinutes: 60 },
  "contact.submit": { limit: 5, windowMinutes: 60 },
  "order.track": { limit: 20, windowMinutes: 15 },
  "order.place": { limit: 10, windowMinutes: 60 },
  // Generous, because liking several products while browsing is normal use. It
  // is here to stop a script inflating a count, not to police a shopper.
  "product.like": { limit: 60, windowMinutes: 10 },
  "admin.search": { limit: 120, windowMinutes: 1 },
} as const;

export type RateLimitBucket = keyof typeof RATE_LIMITS;

export class RateLimitedError extends Error {
  constructor(readonly retryAfterMinutes: number) {
    super("Too many attempts. Please try again in a few minutes.");
    this.name = "RateLimitedError";
  }
}

/**
 * `subject` is whatever is being limited — an IP, a normalised email, an order
 * id. It is hashed by the caller where it is personal data that need not be
 * stored in the clear; an IP is kept as-is because staff need it for abuse
 * investigation and it is already in the audit trail.
 */
export async function recordRateLimitHit(
  bucket: RateLimitBucket,
  subject: string,
  tx?: Queryable,
): Promise<void> {
  const sql = "INSERT INTO rate_limit_hit (bucket, subject) VALUES ($1, $2)";
  if (tx) {
    await tx.query(sql, [bucket, subject]);
    return;
  }
  await query(sql, [bucket, subject]);
}

export async function countRecentHits(bucket: RateLimitBucket, subject: string): Promise<number> {
  const { windowMinutes } = RATE_LIMITS[bucket];
  // The interval is built from the constant above, never from caller input, so
  // there is no path from a request to this string.
  const rows = await query<{ total: string }>(
    `SELECT count(*)::STRING AS total
       FROM rate_limit_hit
      WHERE bucket = $1
        AND subject = $2
        AND occurred_at > now() - INTERVAL '${windowMinutes} minutes'`,
    [bucket, subject],
  );
  return Number(rows[0]?.total ?? 0);
}

export async function isRateLimited(bucket: RateLimitBucket, subject: string): Promise<boolean> {
  return (await countRecentHits(bucket, subject)) >= RATE_LIMITS[bucket].limit;
}

/**
 * Checks every subject before doing the work. Pass the IP and the account
 * identifier together; either one over its limit refuses the request.
 *
 * Subjects are checked in one round trip rather than several — CockroachDB
 * latency is per-statement, and this sits in front of a user-facing action.
 */
export async function assertWithinRateLimit(
  bucket: RateLimitBucket,
  subjects: readonly (string | null | undefined)[],
): Promise<void> {
  const present = subjects.filter((subject): subject is string => Boolean(subject));
  if (present.length === 0) return;

  const { limit, windowMinutes } = RATE_LIMITS[bucket];
  const rows = await query<{ subject: string; total: string }>(
    `SELECT subject, count(*)::STRING AS total
       FROM rate_limit_hit
      WHERE bucket = $1
        AND subject = ANY($2)
        AND occurred_at > now() - INTERVAL '${windowMinutes} minutes'
      GROUP BY subject`,
    [bucket, present],
  );

  for (const row of rows) {
    if (Number(row.total) >= limit) throw new RateLimitedError(windowMinutes);
  }
}

/** Records one hit against every subject, in a single statement. */
export async function recordRateLimitHits(
  bucket: RateLimitBucket,
  subjects: readonly (string | null | undefined)[],
  tx?: Queryable,
): Promise<void> {
  const present = subjects.filter((subject): subject is string => Boolean(subject));
  if (present.length === 0) return;

  const values = present.map((_, index) => `($1, $${index + 2})`).join(", ");
  const sql = `INSERT INTO rate_limit_hit (bucket, subject) VALUES ${values}`;
  const parameters = [bucket, ...present];
  if (tx) {
    await tx.query(sql, parameters);
    return;
  }
  await query(sql, parameters);
}

/**
 * Old hits are rubbish once their window has passed. Kept for a day rather than
 * a window, so an abuse investigation has something to look at.
 */
export async function sweepRateLimitHits(olderThanHours = 24): Promise<number> {
  const rows = await query<{ id: string }>(
    `DELETE FROM rate_limit_hit
      WHERE occurred_at < now() - ($1 || ' hours')::INTERVAL
      RETURNING id`,
    [String(olderThanHours)],
  );
  return rows.length;
}
