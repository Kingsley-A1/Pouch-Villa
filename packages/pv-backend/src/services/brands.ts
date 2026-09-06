import { query, queryOne, type Queryable } from "../db/client";
import { withTransaction } from "../db/transaction";
import { syncAdminSearchDocument, syncDeviceSearchDocumentsForBrand } from "./admin-search-index";
import { deriveUniqueSlug } from "../domain/slug";
import { recordAudit } from "./audit";
import { catalogueImageFrom, type CatalogueImageRef } from "./catalogue-media-urls";

export type AdminBrand = {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
  isActive: boolean;
  /** The logo the CEO set for this brand, or a typed absence. */
  logo: CatalogueImageRef | null;
};

type BrandRow = {
  id: string;
  name: string;
  slug: string;
  sort_order: number;
  is_active: boolean;
  logo_hash: string | null;
  /** INT columns, so strings off the wire. */
  logo_width: string | null;
  logo_height: string | null;
};

const BRAND_COLUMNS = `b.id, b.name, b.slug, b.sort_order, b.is_active,
       m.content_hash AS logo_hash, m.width AS logo_width, m.height AS logo_height`;

const BRAND_FROM = `FROM brand b LEFT JOIN catalogue_media m ON m.brand_id = b.id`;

function toAdminBrand(row: BrandRow): AdminBrand {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    sortOrder: row.sort_order,
    isActive: row.is_active,
    logo: catalogueImageFrom("brand", row.id, row.logo_hash, row.logo_width, row.logo_height),
  };
}

export async function listAllBrands(): Promise<AdminBrand[]> {
  const rows = await query<BrandRow>(
    `SELECT ${BRAND_COLUMNS} ${BRAND_FROM}
      WHERE b.deleted_at IS NULL ORDER BY b.sort_order, b.name`,
  );
  return rows.map(toAdminBrand);
}

export async function getBrand(id: string): Promise<AdminBrand | null> {
  const row = await queryOne<BrandRow>(
    `SELECT ${BRAND_COLUMNS} ${BRAND_FROM}
      WHERE b.id = $1 AND b.deleted_at IS NULL`,
    [id],
  );
  return row === null ? null : toAdminBrand(row);
}

export type BrandInput = { name: string; sortOrder: number };

/**
 * The slug is derived from the name, never typed. Staff should not have to know
 * what a slug is, and a hand-typed one is a standing source of broken URLs.
 *
 * Its own literal statement rather than a shared table name, per AGENTS.md §5.
 */
async function deriveBrandSlug(tx: Queryable, name: string): Promise<string> {
  return deriveUniqueSlug(name, async (pattern) => {
    const rows = await tx.query("SELECT slug FROM brand WHERE slug LIKE $1", [pattern]);
    return (rows.rows as { slug: string }[]).map((row) => row.slug);
  });
}

export async function createBrand(input: BrandInput, actor: { staffId: string }) {
  return withTransaction(async (tx) => {
    const slug = await deriveBrandSlug(tx, input.name);

    const result = await tx.query(
      "INSERT INTO brand (name, slug, sort_order) VALUES ($1, $2, $3) RETURNING id",
      [input.name, slug, input.sortOrder],
    );
    const id = (result.rows[0] as { id: string }).id;
    await recordAudit(tx, {
      actorType: "staff",
      actorId: actor.staffId,
      action: "brand.created",
      entityType: "brand",
      entityId: id,
      after: input,
    });
    await syncAdminSearchDocument(tx, "brand", id);
    return id;
  });
}

export async function updateBrand(id: string, input: BrandInput, actor: { staffId: string }) {
  return withTransaction(async (tx) => {
    const before = await tx.query("SELECT name, slug, sort_order FROM brand WHERE id = $1", [id]);
    if (before.rows.length === 0) return false;

    // The slug is not re-derived on rename. It is already in shop URLs that
    // customers have bookmarked and search engines have indexed, and renaming a
    // brand is a display change, not a decision to move it.
    await tx.query(
      "UPDATE brand SET name = $2, sort_order = $3, updated_at = now() WHERE id = $1",
      [id, input.name, input.sortOrder],
    );
    await recordAudit(tx, {
      actorType: "staff",
      actorId: actor.staffId,
      action: "brand.updated",
      entityType: "brand",
      entityId: id,
      before: before.rows[0],
      after: input,
    });
    await syncAdminSearchDocument(tx, "brand", id);
    await syncDeviceSearchDocumentsForBrand(tx, id);
    return true;
  });
}

export async function setBrandActive(id: string, isActive: boolean, actor: { staffId: string }) {
  await withTransaction(async (tx) => {
    await tx.query("UPDATE brand SET is_active = $2, updated_at = now() WHERE id = $1", [
      id,
      isActive,
    ]);
    await recordAudit(tx, {
      actorType: "staff",
      actorId: actor.staffId,
      action: isActive ? "brand.activated" : "brand.deactivated",
      entityType: "brand",
      entityId: id,
    });
    await syncAdminSearchDocument(tx, "brand", id);
    await syncDeviceSearchDocumentsForBrand(tx, id);
  });
}

export async function softDeleteBrand(id: string, reason: string, actor: { staffId: string }) {
  return withTransaction(async (tx) => {
    await tx.query(
      "UPDATE brand SET deleted_at = now(), deleted_by = $2, deleted_reason = $3 WHERE id = $1",
      [id, actor.staffId, reason],
    );
    await recordAudit(tx, {
      actorType: "staff",
      actorId: actor.staffId,
      action: "brand.deleted",
      entityType: "brand",
      entityId: id,
      after: { reason },
    });
    await syncAdminSearchDocument(tx, "brand", id);
    await syncDeviceSearchDocumentsForBrand(tx, id);
  });
}

export async function countBrands(): Promise<number> {
  const row = await queryOne<{ total: string }>(
    "SELECT count(*)::STRING AS total FROM brand WHERE deleted_at IS NULL",
  );
  return Number(row?.total ?? 0);
}
