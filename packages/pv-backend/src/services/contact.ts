import { query, queryOne } from "../db/client";
import { withTransaction } from "../db/transaction";
import { normalisePhone } from "../domain/phone";
import { normaliseOrderReference } from "../domain/reference";
import { recordAudit } from "./audit";
import { syncAdminSearchDocument } from "./admin-search-index";
import { assertWithinRateLimit, recordRateLimitHits } from "./rate-limit";

/**
 * Contact requests — scope item 12, and admin page 07.
 *
 * The prototype's "Contact" was a WhatsApp message preview that deliberately
 * sent nothing. This actually records the enquiry, so a staff member can see it,
 * answer it, and close it.
 *
 * At least one of email or phone is required, enforced by a database constraint
 * as well as here: an enquiry nobody can reply to is not an enquiry.
 */

export const CONTACT_STATUSES = ["new", "in_progress", "closed"] as const;
export type ContactStatus = (typeof CONTACT_STATUSES)[number];

export class UnreachableEnquiryError extends Error {
  constructor() {
    super("Leave an email address or a phone number so we can reply.");
    this.name = "UnreachableEnquiryError";
  }
}

export class EnquiryNotFoundError extends Error {
  constructor() {
    super("That enquiry was not found.");
    this.name = "EnquiryNotFoundError";
  }
}

export type SubmitContactInput = {
  name: string;
  email?: string | null;
  phone?: string | null;
  subject?: string | null;
  message: string;
  orderReference?: string | null;
};

export async function submitContactRequest(
  input: SubmitContactInput,
  context: { ip?: string | undefined; requestId?: string | undefined } = {},
): Promise<{ enquiryId: string }> {
  const email = input.email?.trim().toLowerCase() || null;
  const phone = input.phone ? normalisePhone(input.phone) : null;
  if (email === null && phone === null) throw new UnreachableEnquiryError();

  const subjects = [context.ip, email ?? phone];
  await assertWithinRateLimit("contact.submit", subjects);

  // A reference typed with spaces or in lower case still links to the order.
  const reference = input.orderReference ? normaliseOrderReference(input.orderReference) : null;

  return withTransaction(async (tx) => {
    const inserted = await tx.query(
      `INSERT INTO contact_request (name, email, phone, subject, message, order_reference, submitted_ip)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id`,
      [
        input.name.trim(),
        email,
        phone,
        input.subject?.trim() || null,
        input.message.trim(),
        reference,
        context.ip ?? null,
      ],
    );
    const enquiryId = (inserted.rows[0] as { id: string }).id;

    await recordRateLimitHits("contact.submit", subjects, tx);

    await recordAudit(tx, {
      actorType: "system",
      action: "contact.submitted",
      entityType: "contact_request",
      entityId: enquiryId,
      after: { hasEmail: email !== null, hasPhone: phone !== null, reference },
      requestId: context.requestId,
      ip: context.ip,
    });
    await syncAdminSearchDocument(tx, "enquiry", enquiryId);

    return { enquiryId };
  });
}

export type ContactRequest = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  subject: string | null;
  message: string;
  orderReference: string | null;
  status: ContactStatus;
  submittedAt: Date;
  handledAt: Date | null;
  staffNote: string | null;
};

type ContactRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  subject: string | null;
  message: string;
  order_reference: string | null;
  status: ContactStatus;
  submitted_at: Date;
  handled_at: Date | null;
  staff_note: string | null;
};

function toContactRequest(row: ContactRow): ContactRequest {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    subject: row.subject,
    message: row.message,
    orderReference: row.order_reference,
    status: row.status,
    submittedAt: row.submitted_at,
    handledAt: row.handled_at,
    staffNote: row.staff_note,
  };
}

const CONTACT_COLUMNS = `id, name, email, phone, subject, message, order_reference, status,
                         submitted_at, handled_at, staff_note`;

export async function listContactRequests(
  filters: { status?: ContactStatus; limit?: number } = {},
): Promise<ContactRequest[]> {
  const conditions = ["deleted_at IS NULL"];
  const values: unknown[] = [];
  if (filters.status) {
    values.push(filters.status);
    conditions.push(`status = $${values.length}`);
  }
  values.push(filters.limit ?? 100);

  const rows = await query<ContactRow>(
    `SELECT ${CONTACT_COLUMNS} FROM contact_request
      WHERE ${conditions.join(" AND ")}
      ORDER BY submitted_at DESC
      LIMIT $${values.length}`,
    values,
  );
  return rows.map(toContactRequest);
}

export async function getContactRequest(id: string): Promise<ContactRequest | null> {
  const row = await queryOne<ContactRow>(
    `SELECT ${CONTACT_COLUMNS} FROM contact_request WHERE id = $1 AND deleted_at IS NULL`,
    [id],
  );
  return row === null ? null : toContactRequest(row);
}

export async function countNewEnquiries(): Promise<number> {
  const row = await queryOne<{ total: string }>(
    "SELECT count(*)::STRING AS total FROM contact_request WHERE status = 'new' AND deleted_at IS NULL",
  );
  return Number(row?.total ?? 0);
}

export async function setContactStatus(
  id: string,
  status: ContactStatus,
  actor: { staffId: string },
  note?: string | null,
): Promise<void> {
  await withTransaction(async (tx) => {
    const before = await tx.query("SELECT status FROM contact_request WHERE id = $1", [id]);
    if (before.rows.length === 0) throw new EnquiryNotFoundError();

    await tx.query(
      `UPDATE contact_request
          SET status = $2,
              handled_by = $3,
              handled_at = CASE WHEN $2 = 'new' THEN NULL ELSE now() END,
              staff_note = coalesce($4, staff_note)
        WHERE id = $1`,
      [id, status, actor.staffId, note ?? null],
    );
    await recordAudit(tx, {
      actorType: "staff",
      actorId: actor.staffId,
      action: "contact.status_changed",
      entityType: "contact_request",
      entityId: id,
      before: before.rows[0],
      after: { status, note: note ?? null },
    });
    await syncAdminSearchDocument(tx, "enquiry", id);
  });
}

export async function softDeleteContactRequest(
  id: string,
  reason: string,
  actor: { staffId: string },
): Promise<void> {
  await withTransaction(async (tx) => {
    await tx.query(
      "UPDATE contact_request SET deleted_at = now(), deleted_by = $2, deleted_reason = $3 WHERE id = $1",
      [id, actor.staffId, reason],
    );
    await recordAudit(tx, {
      actorType: "staff",
      actorId: actor.staffId,
      action: "contact.deleted",
      entityType: "contact_request",
      entityId: id,
      after: { reason },
    });
    await syncAdminSearchDocument(tx, "enquiry", id);
  });
}
