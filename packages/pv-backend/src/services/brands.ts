import { getPool, query, queryOne } from "../db/client";
import { withTransaction } from "../db/transaction";
import { recordAudit } from "./audit";

export type AdminBrand = {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
  isActive: boolean;
};

type BrandRow = { id: string; name: string; slug: string; sort_order: number; is_active: boolean };

function toAdminBrand(row: BrandRow): AdminBrand {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    sortOrder: row.sort_order,
    isActive: row.is_active,
  };
}

export class SlugTakenError extends Error {
  constructor(slug: string) {
    super(`The slug "${slug}" is already in use.`);
    this.name = "SlugTakenError";
  }
}

export async function listAllBrands(): Promise<AdminBrand[]> {
  const rows = await query<BrandRow>(
    "SELECT id, name, slug, sort_order, is_active FROM brand WHERE deleted_at IS NULL ORDER BY sort_order, name",
  );
  return rows.map(toAdminBrand);
}

export async function getBrand(id: string): Promise<AdminBrand | null> {
  const row = await queryOne<BrandRow>(
    "SELECT id, name, slug, sort_order, is_active FROM brand WHERE id = $1 AND deleted_at IS NULL",
    [id],
  );
  return row === null ? null : toAdminBrand(row);
}

export type BrandInput = { name: string; slug: string; sortOrder: number };

export async function createBrand(input: BrandInput, actor: { staffId: string }) {
  return withTransaction(async (tx) => {
    const clash = await tx.query("SELECT id FROM brand WHERE slug = $1 AND deleted_at IS NULL", [
      input.slug,
    ]);
    if (clash.rows.length > 0) throw new SlugTakenError(input.slug);

    const result = await tx.query(
      "INSERT INTO brand (name, slug, sort_order) VALUES ($1, $2, $3) RETURNING id",
      [input.name, input.slug, input.sortOrder],
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
    return id;
  });
}

export async function updateBrand(id: string, input: BrandInput, actor: { staffId: string }) {
  return withTransaction(async (tx) => {
    const before = await tx.query("SELECT name, slug, sort_order FROM brand WHERE id = $1", [id]);
    if (before.rows.length === 0) return false;

    const clash = await tx.query(
      "SELECT id FROM brand WHERE slug = $1 AND id <> $2 AND deleted_at IS NULL",
      [input.slug, id],
    );
    if (clash.rows.length > 0) throw new SlugTakenError(input.slug);

    await tx.query(
      "UPDATE brand SET name = $2, slug = $3, sort_order = $4, updated_at = now() WHERE id = $1",
      [id, input.name, input.slug, input.sortOrder],
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
    return true;
  });
}

export async function setBrandActive(id: string, isActive: boolean, actor: { staffId: string }) {
  await query("UPDATE brand SET is_active = $2, updated_at = now() WHERE id = $1", [id, isActive]);
  await recordAudit(getPool(), {
    actorType: "staff",
    actorId: actor.staffId,
    action: isActive ? "brand.activated" : "brand.deactivated",
    entityType: "brand",
    entityId: id,
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
  });
}

export async function countBrands(): Promise<number> {
  const row = await queryOne<{ total: string }>(
    "SELECT count(*)::STRING AS total FROM brand WHERE deleted_at IS NULL",
  );
  return Number(row?.total ?? 0);
}
