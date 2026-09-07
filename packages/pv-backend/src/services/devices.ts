import { query, type Queryable } from "../db/client";
import { withTransaction } from "../db/transaction";
import { syncAdminSearchDocument } from "./admin-search-index";
import { deriveUniqueSlug } from "../domain/slug";
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
  /** The class this model belongs to — iPhone, iPad — or a typed absence. */
  lineId: string | null;
  lineName: string | null;
};

type DeviceRow = {
  id: string;
  brand_id: string;
  brand_name: string;
  name: string;
  slug: string;
  released_year: number | null;
  sort_order: number;
  line_id: string | null;
  line_name: string | null;
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
    lineId: row.line_id,
    lineName: row.line_name,
  };
}

export async function listAllDevices(): Promise<AdminDevice[]> {
  const rows = await query<DeviceRow>(
    `SELECT d.id, d.brand_id, b.name AS brand_name, d.name, d.slug, d.released_year, d.sort_order,
            d.line_id, l.name AS line_name
       FROM device d
       JOIN brand b ON b.id = d.brand_id
       LEFT JOIN device_line l ON l.id = d.line_id AND l.deleted_at IS NULL
      ORDER BY b.sort_order, b.name, l.sort_order NULLS FIRST, l.name, d.sort_order, d.name`,
  );
  return rows.map(toDevice);
}

export type DeviceInput = {
  brandId: string;
  name: string;
  releasedYear: number | null;
  sortOrder: number;
  /** Optional: a model filed under no class is still a perfectly good model. */
  lineId: string | null;
};

/**
 * The slug is derived from the name, never typed.
 *
 * Scoped to the brand, because `device_brand_slug_idx` is unique on
 * `(brand_id, slug)` rather than on the slug alone — two makers may both sell a
 * model called "Note 12", and each keeps the obvious slug under its own brand.
 * Its own literal statement rather than a shared table name, per AGENTS.md §5.
 */
async function deriveDeviceSlug(tx: Queryable, brandId: string, name: string): Promise<string> {
  return deriveUniqueSlug(name, async (pattern) => {
    const rows = await tx.query("SELECT slug FROM device WHERE brand_id = $1 AND slug LIKE $2", [
      brandId,
      pattern,
    ]);
    return (rows.rows as { slug: string }[]).map((row) => row.slug);
  });
}

export async function createDevice(input: DeviceInput, actor: { staffId: string }) {
  return withTransaction(async (tx) => {
    const slug = await deriveDeviceSlug(tx, input.brandId, input.name);

    const result = await tx.query(
      `INSERT INTO device (brand_id, name, slug, released_year, sort_order, line_id)
            VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
      [
        input.brandId,
        input.name,
        slug,
        input.releasedYear,
        input.sortOrder,
        // Guarded rather than trusted: a class belonging to another brand would
        // put an iPad under Samsung, which the form cannot do but an API caller
        // could. §3 says the service is the boundary, not the form.
        await lineIdWithinBrand(tx, input.lineId, input.brandId),
      ],
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
      "SELECT brand_id, name, slug, released_year, sort_order, line_id FROM device WHERE id = $1",
      [id],
    );
    if (before.rows.length === 0) return false;

    // Moving a device to another brand re-derives its slug, because uniqueness
    // is per brand and the existing one may already be taken there. A rename
    // alone keeps it: the slug is in "fits my phone" URLs customers may hold.
    const current = before.rows[0] as { brand_id: string; slug: string };
    const slug =
      current.brand_id === input.brandId
        ? current.slug
        : await deriveDeviceSlug(tx, input.brandId, input.name);

    await tx.query(
      `UPDATE device
          SET brand_id = $2, name = $3, slug = $4, released_year = $5, sort_order = $6,
              line_id = $7
        WHERE id = $1`,
      [
        id,
        input.brandId,
        input.name,
        slug,
        input.releasedYear,
        input.sortOrder,
        await lineIdWithinBrand(tx, input.lineId, input.brandId),
      ],
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

/**
 * Device classes — the tier between a make and a model.
 *
 * Apple sells iPhones and iPads; Samsung sells Galaxy phones and Galaxy Tabs.
 * Without this the models are one flat list per brand, which is fine at five and
 * unreadable at thirty.
 *
 * Every part of it is optional. A brand with no classes behaves exactly as it
 * did — its models flat — because a tier nobody filled in must not become an
 * empty step in front of a customer.
 */

export type AdminDeviceLine = {
  id: string;
  brandId: string;
  brandName: string;
  name: string;
  slug: string;
  sortOrder: number;
  /** How many models are filed under it, so an empty class is visible as one. */
  deviceCount: number;
};

export async function listAllDeviceLines(): Promise<AdminDeviceLine[]> {
  const rows = await query<{
    id: string;
    brand_id: string;
    brand_name: string;
    name: string;
    slug: string;
    sort_order: number;
    device_count: string;
  }>(
    `SELECT l.id, l.brand_id, b.name AS brand_name, l.name, l.slug, l.sort_order,
            (SELECT count(*)::STRING FROM device d WHERE d.line_id = l.id) AS device_count
       FROM device_line l
       JOIN brand b ON b.id = l.brand_id
      WHERE l.deleted_at IS NULL
      ORDER BY b.sort_order, b.name, l.sort_order, l.name`,
  );
  return rows.map((row) => ({
    id: row.id,
    brandId: row.brand_id,
    brandName: row.brand_name,
    name: row.name,
    slug: row.slug,
    sortOrder: row.sort_order,
    deviceCount: Number(row.device_count),
  }));
}

export type DeviceLineInput = { brandId: string; name: string; sortOrder: number };

/** Scoped to the brand, because the unique index is on `(brand_id, slug)`. */
async function deriveLineSlug(tx: Queryable, brandId: string, name: string): Promise<string> {
  return deriveUniqueSlug(name, async (pattern) => {
    const rows = await tx.query(
      "SELECT slug FROM device_line WHERE brand_id = $1 AND slug LIKE $2 AND deleted_at IS NULL",
      [brandId, pattern],
    );
    return (rows.rows as { slug: string }[]).map((row) => row.slug);
  });
}

/**
 * Refuses a class that belongs to a different brand.
 *
 * The admin form can only offer the chosen brand's classes, so this cannot be
 * reached through the UI — which is the reason it is here rather than there. §3
 * puts authority in the service, and an API client filing an iPad under Samsung
 * would otherwise produce a browse path that lies about what fits what.
 */
async function lineIdWithinBrand(
  tx: Queryable,
  lineId: string | null,
  brandId: string,
): Promise<string | null> {
  if (lineId === null) return null;
  const rows = await tx.query(
    "SELECT id FROM device_line WHERE id = $1 AND brand_id = $2 AND deleted_at IS NULL",
    [lineId, brandId],
  );
  return rows.rows.length > 0 ? lineId : null;
}

export async function createDeviceLine(input: DeviceLineInput, actor: { staffId: string }) {
  return withTransaction(async (tx) => {
    const slug = await deriveLineSlug(tx, input.brandId, input.name);
    const result = await tx.query(
      `INSERT INTO device_line (brand_id, name, slug, sort_order, created_by, updated_by)
            VALUES ($1, $2, $3, $4, $5, $5)
         RETURNING id`,
      [input.brandId, input.name, slug, input.sortOrder, actor.staffId],
    );
    const id = (result.rows[0] as { id: string }).id;
    await recordAudit(tx, {
      actorType: "staff",
      actorId: actor.staffId,
      action: "device_line.created",
      entityType: "device_line",
      entityId: id,
      after: input,
    });
    return id;
  });
}

export async function updateDeviceLine(
  id: string,
  input: DeviceLineInput,
  actor: { staffId: string },
) {
  return withTransaction(async (tx) => {
    const before = await tx.query(
      "SELECT brand_id, name, slug, sort_order FROM device_line WHERE id = $1 AND deleted_at IS NULL",
      [id],
    );
    const current = before.rows[0] as { brand_id: string; slug: string } | undefined;
    if (current === undefined) return false;

    // The slug is a public URL once the browse path uses it, so a rename keeps
    // it. Moving to another brand re-derives, because it may be taken there.
    const slug =
      current.brand_id === input.brandId
        ? current.slug
        : await deriveLineSlug(tx, input.brandId, input.name);

    await tx.query(
      `UPDATE device_line
          SET brand_id = $2, name = $3, slug = $4, sort_order = $5,
              updated_at = now(), updated_by = $6
        WHERE id = $1`,
      [id, input.brandId, input.name, slug, input.sortOrder, actor.staffId],
    );
    await recordAudit(tx, {
      actorType: "staff",
      actorId: actor.staffId,
      action: "device_line.updated",
      entityType: "device_line",
      entityId: id,
      before: before.rows[0],
      after: input,
    });
    return true;
  });
}

/**
 * Soft-deleted, and its models are unfiled rather than deleted with it.
 *
 * A class is a way of arranging models, not a thing that owns them. Removing
 * "iPad" must not remove the iPads, or a mis-tap takes the compatibility of
 * every product that fits one.
 */
export async function deleteDeviceLine(id: string, actor: { staffId: string }) {
  return withTransaction(async (tx) => {
    const removed = await tx.query(
      `UPDATE device_line SET deleted_at = now(), deleted_by = $2
        WHERE id = $1 AND deleted_at IS NULL
    RETURNING name`,
      [id, actor.staffId],
    );
    if (removed.rows.length === 0) return false;
    await tx.query("UPDATE device SET line_id = NULL WHERE line_id = $1", [id]);
    await recordAudit(tx, {
      actorType: "staff",
      actorId: actor.staffId,
      action: "device_line.deleted",
      entityType: "device_line",
      entityId: id,
      before: removed.rows[0],
    });
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
