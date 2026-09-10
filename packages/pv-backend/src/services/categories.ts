import { query, queryOne, type Queryable } from "../db/client";
import { withTransaction } from "../db/transaction";
import { syncAdminSearchDocument } from "./admin-search-index";
import { deriveUniqueSlug } from "../domain/slug";
import { recordAudit } from "./audit";
import { catalogueImageFrom, type CatalogueImageRef } from "./catalogue-media-urls";

export type AdminCategory = {
  id: string;
  parentId: string | null;
  name: string;
  slug: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  /**
   * Whether products filed here are chosen by the device they fit.
   *
   * True for pouches and cases; false for accessories, which are chosen by what
   * they are. Meaningful on a top-level category only — a child inherits its
   * root's answer, and `rootFitsDevices` is what callers should read.
   */
  fitsDevices: boolean;
  /** The photograph the CEO set for this category, or a typed absence. */
  image: CatalogueImageRef | null;
};

type CategoryRow = {
  id: string;
  parent_id: string | null;
  name: string;
  slug: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
  fits_devices: boolean;
  image_hash: string | null;
  /** INT columns, so strings off the wire. */
  image_width: string | null;
  image_height: string | null;
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
    fitsDevices: row.fits_devices,
    image: catalogueImageFrom(
      "category",
      row.id,
      row.image_hash,
      row.image_width,
      row.image_height,
    ),
  };
}

/**
 * The columns every read of a category needs in order to render its tile.
 *
 * A left join rather than a second query: one round trip matters more here than
 * elsewhere because CockroachDB charges latency per statement (AGENTS.md
 * section 3), and this list is read on every admin page that offers a parent.
 */
const CATEGORY_COLUMNS = `c.id, c.parent_id, c.name, c.slug, c.description, c.sort_order,
       c.is_active, c.fits_devices, m.content_hash AS image_hash, m.width AS image_width,
       m.height AS image_height`;

const CATEGORY_FROM = `FROM category c LEFT JOIN catalogue_media m ON m.category_id = c.id`;

/** Includes inactive rows — the admin manages what the storefront hides. */
export async function listAllCategories(): Promise<AdminCategory[]> {
  const rows = await query<CategoryRow>(
    `SELECT ${CATEGORY_COLUMNS}
       ${CATEGORY_FROM}
      WHERE c.deleted_at IS NULL
      ORDER BY c.sort_order, c.name`,
  );
  return rows.map(toAdminCategory);
}

export type CategoryInput = {
  parentId: string | null;
  name: string;
  description: string | null;
  sortOrder: number;
  /**
   * Only read for a top-level category. A child's own value is written but never
   * consulted — `rootFitsDevices` resolves from the root — so a mis-set child
   * cannot make a section disagree with itself.
   */
  fitsDevices: boolean;
};

/**
 * The slug is derived from the name, never typed. Its own literal statement
 * rather than a shared table name, per AGENTS.md §5.
 */
async function deriveCategorySlug(tx: Queryable, name: string): Promise<string> {
  return deriveUniqueSlug(name, async (pattern) => {
    const rows = await tx.query("SELECT slug FROM category WHERE slug LIKE $1", [pattern]);
    return (rows.rows as { slug: string }[]).map((row) => row.slug);
  });
}

export async function createCategory(input: CategoryInput, actor: { staffId: string }) {
  return withTransaction(async (tx) => {
    const slug = await deriveCategorySlug(tx, input.name);

    const result = await tx.query(
      `INSERT INTO category (parent_id, name, slug, description, sort_order, fits_devices)
            VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
      [input.parentId, input.name, slug, input.description, input.sortOrder, input.fitsDevices],
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
      "SELECT parent_id, name, slug, description, sort_order, fits_devices FROM category WHERE id = $1",
      [id],
    );
    if (before.rows.length === 0) return false;

    // The slug is not re-derived on rename: it is already in shop URLs that
    // customers have bookmarked and search engines have indexed.
    await tx.query(
      `UPDATE category
          SET parent_id = $2, name = $3, description = $4, sort_order = $5,
              fits_devices = $6, updated_at = now()
        WHERE id = $1`,
      [id, input.parentId, input.name, input.description, input.sortOrder, input.fitsDevices],
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
    `SELECT ${CATEGORY_COLUMNS}
       ${CATEGORY_FROM}
      WHERE c.id = $1 AND c.deleted_at IS NULL`,
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

/**
 * Whether a category's section is chosen by device fit, resolved from its root.
 *
 * A child inherits: "Screen Protectors" is not separately a device-fitting
 * section, it is part of one. Written as a recursive walk up `parent_id` rather
 * than a join, because the tree is two deep in practice and a CTE here would be
 * a distributed query for two rows (AGENTS.md section 3).
 *
 * An unknown category answers `true` — the behaviour every category had before
 * this column existed, so a bad id degrades to the old form rather than to a
 * shape the admin has never seen.
 */
export async function rootFitsDevices(categoryId: string): Promise<boolean> {
  const row = await queryOne<{ fits_devices: boolean }>(
    `WITH RECURSIVE up AS (
       SELECT id, parent_id, fits_devices FROM category WHERE id = $1 AND deleted_at IS NULL
       UNION ALL
       SELECT c.id, c.parent_id, c.fits_devices
         FROM category c JOIN up ON up.parent_id = c.id
        WHERE c.deleted_at IS NULL
     )
     SELECT fits_devices FROM up WHERE parent_id IS NULL LIMIT 1`,
    [categoryId],
  );
  return row === null ? true : row.fits_devices;
}
