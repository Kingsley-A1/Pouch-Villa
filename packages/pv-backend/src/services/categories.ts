import { query, queryOne } from "../db/client";
import { withTransaction } from "../db/transaction";
import { syncAdminSearchDocument } from "./admin-search-index";
import { recordAudit } from "./audit";

export type AdminCategory = {
  id: string;
  parentId: string | null;
  name: string;
  slug: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
};

type CategoryRow = {
  id: string;
  parent_id: string | null;
  name: string;
  slug: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
};

function toAdminCategory(row: CategoryRow): AdminCategory {
  return {
    id: row.id,
    parentId: row.parent_id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    sortOrder: row.sort_order,
    isActive: row.is_active,
  };
}

/** Includes inactive rows — the admin manages what the storefront hides. */
export async function listAllCategories(): Promise<AdminCategory[]> {
  const rows = await query<CategoryRow>(
    `SELECT id, parent_id, name, slug, description, sort_order, is_active
       FROM category
      WHERE deleted_at IS NULL
      ORDER BY sort_order, name`,
  );
  return rows.map(toAdminCategory);
}

export class SlugTakenError extends Error {
  constructor(slug: string) {
    super(`The slug "${slug}" is already in use.`);
    this.name = "SlugTakenError";
  }
}

export type CategoryInput = {
  parentId: string | null;
  name: string;
  slug: string;
  description: string | null;
  sortOrder: number;
};

export async function createCategory(input: CategoryInput, actor: { staffId: string }) {
  return withTransaction(async (tx) => {
    const clash = await tx.query("SELECT id FROM category WHERE slug = $1 AND deleted_at IS NULL", [
      input.slug,
    ]);
    if (clash.rows.length > 0) throw new SlugTakenError(input.slug);

    const result = await tx.query(
      `INSERT INTO category (parent_id, name, slug, description, sort_order)
            VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
      [input.parentId, input.name, input.slug, input.description, input.sortOrder],
    );
    const id = (result.rows[0] as { id: string }).id;
    await recordAudit(tx, {
      actorType: "staff",
      actorId: actor.staffId,
      action: "category.created",
      entityType: "category",
      entityId: id,
      after: input,
    });
    await syncAdminSearchDocument(tx, "category", id);
    return id;
  });
}

export async function updateCategory(id: string, input: CategoryInput, actor: { staffId: string }) {
  return withTransaction(async (tx) => {
    const before = await tx.query(
      "SELECT parent_id, name, slug, description, sort_order FROM category WHERE id = $1",
      [id],
    );
    if (before.rows.length === 0) return false;

    const clash = await tx.query(
      "SELECT id FROM category WHERE slug = $1 AND id <> $2 AND deleted_at IS NULL",
      [input.slug, id],
    );
    if (clash.rows.length > 0) throw new SlugTakenError(input.slug);

    await tx.query(
      `UPDATE category
          SET parent_id = $2, name = $3, slug = $4, description = $5, sort_order = $6,
              updated_at = now()
        WHERE id = $1`,
      [id, input.parentId, input.name, input.slug, input.description, input.sortOrder],
    );
    await recordAudit(tx, {
      actorType: "staff",
      actorId: actor.staffId,
      action: "category.updated",
      entityType: "category",
      entityId: id,
      before: before.rows[0],
      after: input,
    });
    await syncAdminSearchDocument(tx, "category", id);
    return true;
  });
}

export async function setCategoryActive(id: string, isActive: boolean, actor: { staffId: string }) {
  await withTransaction(async (tx) => {
    await tx.query("UPDATE category SET is_active = $2, updated_at = now() WHERE id = $1", [
      id,
      isActive,
    ]);
    await recordAudit(tx, {
      actorType: "staff",
      actorId: actor.staffId,
      action: isActive ? "category.activated" : "category.deactivated",
      entityType: "category",
      entityId: id,
    });
    await syncAdminSearchDocument(tx, "category", id);
  });
}

export async function softDeleteCategory(id: string, reason: string, actor: { staffId: string }) {
  return withTransaction(async (tx) => {
    const hasChildren = await tx.query(
      "SELECT id FROM category WHERE parent_id = $1 AND deleted_at IS NULL LIMIT 1",
      [id],
    );
    if (hasChildren.rows.length > 0) {
      throw new Error("Move or remove its subcategories first.");
    }
    await tx.query(
      "UPDATE category SET deleted_at = now(), deleted_by = $2, deleted_reason = $3 WHERE id = $1",
      [id, actor.staffId, reason],
    );
    await recordAudit(tx, {
      actorType: "staff",
      actorId: actor.staffId,
      action: "category.deleted",
      entityType: "category",
      entityId: id,
      after: { reason },
    });
    await syncAdminSearchDocument(tx, "category", id);
  });
}

export async function getCategory(id: string): Promise<AdminCategory | null> {
  const row = await queryOne<CategoryRow>(
    `SELECT id, parent_id, name, slug, description, sort_order, is_active
       FROM category WHERE id = $1 AND deleted_at IS NULL`,
    [id],
  );
  return row === null ? null : toAdminCategory(row);
}

export async function countCategories(): Promise<number> {
  const row = await queryOne<{ total: string }>(
    "SELECT count(*)::STRING AS total FROM category WHERE deleted_at IS NULL",
  );
  return Number(row?.total ?? 0);
}
