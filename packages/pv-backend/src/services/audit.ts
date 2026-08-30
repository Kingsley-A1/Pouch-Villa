import type { Queryable } from "../db/client";

/**
 * Audit records are append-only: there is no update and no delete, here or
 * anywhere. A privileged mutation writes one inside the same transaction as the
 * change itself, so a committed change always has its record and a rolled-back one
 * leaves none.
 */

export type AuditActorType = "staff" | "customer" | "system";

export type AuditEntry = {
  actorType: AuditActorType;
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  requestId?: string | undefined;
  ip?: string | undefined;
};

/**
 * Values that must never reach the audit trail, because it is read by staff and
 * exported for review. Redaction happens here rather than at each call site, so
 * forgetting is not possible.
 */
const REDACTED_KEYS = new Set([
  "password",
  "password_hash",
  "passwordhash",
  "token",
  "token_hash",
  "code",
  "code_hash",
  "totp_secret",
  "secret",
  "authorization",
  "cookie",
]);

export function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value === null || typeof value !== "object") return value;
  const output: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    output[key] = REDACTED_KEYS.has(key.toLowerCase()) ? "[redacted]" : redact(nested);
  }
  return output;
}

export async function recordAudit(tx: Queryable, entry: AuditEntry) {
  await tx.query(
    `INSERT INTO audit_event
       (actor_type, actor_id, action, entity_type, entity_id, before, after, request_id, ip)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      entry.actorType,
      entry.actorId ?? null,
      entry.action,
      entry.entityType,
      entry.entityId ?? null,
      entry.before === undefined ? null : JSON.stringify(redact(entry.before)),
      entry.after === undefined ? null : JSON.stringify(redact(entry.after)),
      entry.requestId ?? null,
      entry.ip ?? null,
    ],
  );
}
