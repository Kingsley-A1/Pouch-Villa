import { query, queryOne } from "../db/client";
import { withTransaction } from "../db/transaction";
import { koboFromDatabase, type Kobo } from "../domain/money";
import { recordAudit } from "./audit";
import { syncAdminSearchDocument } from "./admin-search-index";

/**
 * Delivery zones, fees and timeframes as admin-managed rows (Q8). An order's
 * delivery line resolves to zero until a zone exists for it — it is never a
 * guessed figure.
 */

export type DeliveryZone = {
  id: string;
  name: string;
  lga: string | null;
  feeKobo: Kobo;
  minDays: number | null;
  maxDays: number | null;
  isActive: boolean;
  sortOrder: number;
};

type ZoneRow = {
  id: string;
  name: string;
  lga: string | null;
  fee_kobo: string;
  min_days: string | null;
  max_days: string | null;
  is_active: boolean;
  sort_order: string;
};

function toZone(row: ZoneRow): DeliveryZone {
  return {
    id: row.id,
    name: row.name,
    lga: row.lga,
    feeKobo: koboFromDatabase(row.fee_kobo),
    minDays: row.min_days === null ? null : Number(row.min_days),
    maxDays: row.max_days === null ? null : Number(row.max_days),
    isActive: row.is_active,
    sortOrder: Number(row.sort_order),
  };
}

export async function listAllDeliveryZones(): Promise<DeliveryZone[]> {
  const rows = await query<ZoneRow>(
    `SELECT id, name, lga, fee_kobo::STRING AS fee_kobo,
            min_days::STRING AS min_days, max_days::STRING AS max_days,
            is_active, sort_order::STRING AS sort_order
       FROM delivery_zone
      WHERE deleted_at IS NULL
      ORDER BY sort_order, name`,
  );
  return rows.map(toZone);
}

export async function listActiveDeliveryZones(): Promise<DeliveryZone[]> {
  const rows = await query<ZoneRow>(
    `SELECT id, name, lga, fee_kobo::STRING AS fee_kobo,
            min_days::STRING AS min_days, max_days::STRING AS max_days,
            is_active, sort_order::STRING AS sort_order
       FROM delivery_zone
      WHERE deleted_at IS NULL AND is_active
      ORDER BY sort_order, name`,
  );
  return rows.map(toZone);
}

export async function getDeliveryZone(id: string): Promise<DeliveryZone | null> {
  const row = await queryOne<ZoneRow>(
    `SELECT id, name, lga, fee_kobo::STRING AS fee_kobo,
            min_days::STRING AS min_days, max_days::STRING AS max_days,
            is_active, sort_order::STRING AS sort_order
       FROM delivery_zone WHERE id = $1 AND deleted_at IS NULL`,
    [id],
  );
  return row === null ? null : toZone(row);
}

export type DeliveryZoneInput = {
  name: string;
  lga: string | null;
  feeKobo: Kobo;
  minDays: number | null;
  maxDays: number | null;
};

export class InvalidTimeframeError extends Error {
  constructor() {
    super("The maximum delivery days cannot be less than the minimum.");
    this.name = "InvalidTimeframeError";
  }
}

function assertValidTimeframe(input: DeliveryZoneInput) {
  if (input.minDays !== null && input.maxDays !== null && input.maxDays < input.minDays) {
    throw new InvalidTimeframeError();
  }
}

export async function createDeliveryZone(input: DeliveryZoneInput, actor: { staffId: string }) {
  assertValidTimeframe(input);
  return withTransaction(async (tx) => {
    const result = await tx.query(
      `INSERT INTO delivery_zone (name, lga, fee_kobo, min_days, max_days, sort_order)
            SELECT $1, $2, $3, $4, $5, coalesce(max(sort_order), -1) + 1
              FROM delivery_zone
         RETURNING id`,
      [input.name, input.lga, input.feeKobo, input.minDays, input.maxDays],
    );
    const id = (result.rows[0] as { id: string }).id;
    await recordAudit(tx, {
      actorType: "staff",
      actorId: actor.staffId,
      action: "delivery_zone.created",
      entityType: "delivery_zone",
      entityId: id,
      after: input,
    });
    await syncAdminSearchDocument(tx, "delivery_zone", id);
    return id;
  });
}

export async function updateDeliveryZone(
  id: string,
  input: DeliveryZoneInput,
  actor: { staffId: string },
) {
  assertValidTimeframe(input);
  return withTransaction(async (tx) => {
    const before = await tx.query(
      "SELECT name, lga, fee_kobo, min_days, max_days, sort_order FROM delivery_zone WHERE id = $1",
      [id],
    );
    if (before.rows.length === 0) return false;

    await tx.query(
      `UPDATE delivery_zone
          SET name = $2, lga = $3, fee_kobo = $4, min_days = $5, max_days = $6,
              updated_at = now()
        WHERE id = $1`,
      [id, input.name, input.lga, input.feeKobo, input.minDays, input.maxDays],
    );
    await recordAudit(tx, {
      actorType: "staff",
      actorId: actor.staffId,
      action: "delivery_zone.updated",
      entityType: "delivery_zone",
      entityId: id,
      before: before.rows[0],
      after: input,
    });
    await syncAdminSearchDocument(tx, "delivery_zone", id);
    return true;
  });
}

export async function setDeliveryZoneActive(
  id: string,
  isActive: boolean,
  actor: { staffId: string },
) {
  await withTransaction(async (tx) => {
    await tx.query("UPDATE delivery_zone SET is_active = $2, updated_at = now() WHERE id = $1", [
      id,
      isActive,
    ]);
    await recordAudit(tx, {
      actorType: "staff",
      actorId: actor.staffId,
      action: isActive ? "delivery_zone.activated" : "delivery_zone.deactivated",
      entityType: "delivery_zone",
      entityId: id,
    });
    await syncAdminSearchDocument(tx, "delivery_zone", id);
  });
}

export async function softDeleteDeliveryZone(
  id: string,
  reason: string,
  actor: { staffId: string },
) {
  return withTransaction(async (tx) => {
    await tx.query(
      "UPDATE delivery_zone SET deleted_at = now(), deleted_by = $2, deleted_reason = $3 WHERE id = $1",
      [id, actor.staffId, reason],
    );
    await recordAudit(tx, {
      actorType: "staff",
      actorId: actor.staffId,
      action: "delivery_zone.deleted",
      entityType: "delivery_zone",
      entityId: id,
      after: { reason },
    });
    await syncAdminSearchDocument(tx, "delivery_zone", id);
  });
}
