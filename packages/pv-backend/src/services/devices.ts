import { query } from "../db/client";
import { withTransaction } from "../db/transaction";
import { syncAdminSearchDocument } from "./admin-search-index";
import { recordAudit } from "./audit";

/**
 * Devices and product compatibility.
 *
 * With Q1 answered — accessories, no handsets — "does this fit my phone" is the
 * catalogue's differentiating facet rather than a leftover from the prototype.
 * A device is a phone model an accessory can fit, not something Pouch Villa sells.
 */

export type AdminDevice = {
  id: string;
  brandId: string;
  brandName: string;
  name: string;
  slug: string;
  releasedYear: number | null;
  sortOrder: number;
};

type DeviceRow = {
  id: string;
  brand_id: string;
  brand_name: string;
  name: string;
  slug: string;
  released_year: number | null;
  sort_order: number;
};

function toDevice(row: DeviceRow): AdminDevice {
  return {
    id: row.id,
    brandId: row.brand_id,
    brandName: row.brand_name,
    name: row.name,
    slug: row.slug,
    releasedYear: row.released_year,
    sortOrder: row.sort_order,
  };
}

export async function listAllDevices(): Promise<AdminDevice[]> {
  const rows = await query<DeviceRow>(
    `SELECT d.id, d.brand_id, b.name AS brand_name, d.name, d.slug, d.released_year, d.sort_order
       FROM device d JOIN brand b ON b.id = d.brand_id
      ORDER BY b.sort_order, b.name, d.sort_order, d.name`,
  );
  return rows.map(toDevice);
}

export class DeviceSlugTakenError extends Error {
  constructor(slug: string) {
    super(`That brand already has a device with the slug "${slug}".`);
    this.name = "DeviceSlugTakenError";
  }
}

export type DeviceInput = {
  brandId: string;
  name: string;
  slug: string;
  releasedYear: number | null;
  sortOrder: number;
};

export async function createDevice(input: DeviceInput, actor: { staffId: string }) {
  return withTransaction(async (tx) => {
    const clash = await tx.query("SELECT id FROM device WHERE brand_id = $1 AND slug = $2", [
      input.brandId,
      input.slug,
    ]);
    if (clash.rows.length > 0) throw new DeviceSlugTakenError(input.slug);

    const result = await tx.query(
      `INSERT INTO device (brand_id, name, slug, released_year, sort_order)
            VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
      [input.brandId, input.name, input.slug, input.releasedYear, input.sortOrder],
    );
    const id = (result.rows[0] as { id: string }).id;
    await recordAudit(tx, {
      actorType: "staff",
      actorId: actor.staffId,
      action: "device.created",
      entityType: "device",
      entityId: id,
      after: input,
    });
    await syncAdminSearchDocument(tx, "device", id);
    return id;
  });
}

export async function updateDevice(id: string, input: DeviceInput, actor: { staffId: string }) {
  return withTransaction(async (tx) => {
    const before = await tx.query(
      "SELECT brand_id, name, slug, released_year, sort_order FROM device WHERE id = $1",
      [id],
    );
    if (before.rows.length === 0) return false;

    const clash = await tx.query(
      "SELECT id FROM device WHERE brand_id = $1 AND slug = $2 AND id <> $3",
      [input.brandId, input.slug, id],
    );
    if (clash.rows.length > 0) throw new DeviceSlugTakenError(input.slug);

    await tx.query(
      `UPDATE device
          SET brand_id = $2, name = $3, slug = $4, released_year = $5, sort_order = $6
        WHERE id = $1`,
      [id, input.brandId, input.name, input.slug, input.releasedYear, input.sortOrder],
    );
    await recordAudit(tx, {
      actorType: "staff",
      actorId: actor.staffId,
      action: "device.updated",
      entityType: "device",
      entityId: id,
      before: before.rows[0],
      after: input,
    });
    await syncAdminSearchDocument(tx, "device", id);
    return true;
  });
}

/**
 * Devices are hard-deleted rather than soft-deleted: unlike a product or an
 * order, a device carries no history worth keeping and appears in no receipt.
 * Its compatibility links go with it via ON DELETE CASCADE.
 */
export async function deleteDevice(id: string, actor: { staffId: string }) {
  return withTransaction(async (tx) => {
    const removed = await tx.query("DELETE FROM device WHERE id = $1 RETURNING name", [id]);
    if (removed.rows.length === 0) return false;
    await recordAudit(tx, {
      actorType: "staff",
      actorId: actor.staffId,
      action: "device.deleted",
      entityType: "device",
      entityId: id,
      before: removed.rows[0],
    });
    await syncAdminSearchDocument(tx, "device", id);
    return true;
  });
}

export async function listCompatibility(productId: string): Promise<string[]> {
  const rows = await query<{ device_id: string }>(
    "SELECT device_id FROM product_compatibility WHERE product_id = $1",
    [productId],
  );
  return rows.map((row) => row.device_id);
}

export async function setCompatibility(
  productId: string,
  deviceIds: readonly string[],
  actor: { staffId: string },
) {
  return withTransaction(async (tx) => {
    const before = await tx.query(
      "SELECT device_id FROM product_compatibility WHERE product_id = $1",
      [productId],
    );
    await tx.query("DELETE FROM product_compatibility WHERE product_id = $1", [productId]);
    for (const deviceId of deviceIds) {
      await tx.query("INSERT INTO product_compatibility (product_id, device_id) VALUES ($1, $2)", [
        productId,
        deviceId,
      ]);
    }
    await recordAudit(tx, {
      actorType: "staff",
      actorId: actor.staffId,
      action: "product.compatibility_changed",
      entityType: "product",
      entityId: productId,
      before: { deviceIds: before.rows.map((r) => (r as { device_id: string }).device_id) },
      after: { deviceIds: [...deviceIds] },
    });
  });
}
