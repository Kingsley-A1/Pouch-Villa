import { query, queryOne } from "../db/client";
import { withTransaction } from "../db/transaction";
import { listPublishedProducts, listPublishedProductsByIds } from "./catalogue";
import type { CatalogueListItem } from "./catalogue";
import { recordAudit } from "./audit";
import type { HomeSectionLayout } from "../domain/section-layout";

/**
 * How the home page is composed.
 *
 * The storefront previously rendered one hardcoded grid of the eight newest
 * products. This makes the arrangement a runtime decision the CEO owns, in the
 * three shapes a shop actually merchandises in — a category rule, a brand rule,
 * or a hand-picked collection. See `migrations/0009_storefront.sql` for why the
 * three are distinct rather than collapsed into one.
 */

export type HomeSectionKind = "category" | "brand" | "collection";

/** Re-exported so a caller holding a section does not need a second import. */
export { SECTION_LAYOUTS, type HomeSectionLayout } from "../domain/section-layout";

export type AdminHomeSection = {
  id: string;
  kind: HomeSectionKind;
  layout: HomeSectionLayout;
  title: string;
  subtitle: string | null;
  categoryId: string | null;
  brandId: string | null;
  /** Resolved for display, so the admin list does not have to join client-side. */
  sourceName: string | null;
  sourceSlug: string | null;
  maxItems: number;
  sortOrder: number;
  isActive: boolean;
  /** Hand-picked members. Always 0 for a rule-driven section. */
  pickedCount: number;
};

/** A section with its products resolved, ready to render. */
export type HomeSection = {
  id: string;
  kind: HomeSectionKind;
  layout: HomeSectionLayout;
  title: string;
  subtitle: string | null;
  /** Where "See all" goes, or null for a collection, which has no shop filter. */
  browseHref: string | null;
  products: CatalogueListItem[];
};

type SectionRow = {
  id: string;
  kind: HomeSectionKind;
  layout: HomeSectionLayout;
  title: string;
  subtitle: string | null;
  category_id: string | null;
  brand_id: string | null;
  source_name: string | null;
  source_slug: string | null;
  max_items: number;
  sort_order: number;
  is_active: boolean;
  picked_count: string;
};

/**
 * Joins both possible sources in one pass. A section references at most one, and
 * the CHECK constraint guarantees which, so exactly one side is ever non-null.
 */
const SECTION_SELECT = `
  SELECT s.id, s.kind, s.layout, s.title, s.subtitle, s.category_id, s.brand_id,
         coalesce(c.name, b.name) AS source_name,
         coalesce(c.slug, b.slug) AS source_slug,
         s.max_items, s.sort_order, s.is_active,
         (SELECT count(*)::STRING FROM home_section_product hsp
           WHERE hsp.section_id = s.id) AS picked_count
    FROM home_section s
    LEFT JOIN category c ON c.id = s.category_id AND c.deleted_at IS NULL
    LEFT JOIN brand b ON b.id = s.brand_id AND b.deleted_at IS NULL
`;

function toAdminSection(row: SectionRow): AdminHomeSection {
  return {
    id: row.id,
    kind: row.kind,
    layout: row.layout,
    title: row.title,
    subtitle: row.subtitle,
    categoryId: row.category_id,
    brandId: row.brand_id,
    sourceName: row.source_name,
    sourceSlug: row.source_slug,
    maxItems: row.max_items,
    sortOrder: row.sort_order,
    isActive: row.is_active,
    pickedCount: Number(row.picked_count),
  };
}

/** Includes inactive rows — the admin manages what the storefront hides. */
export async function listAllHomeSections(): Promise<AdminHomeSection[]> {
  const rows = await query<SectionRow>(
    `${SECTION_SELECT} WHERE s.deleted_at IS NULL ORDER BY s.sort_order, s.title`,
  );
  return rows.map(toAdminSection);
}

export async function getHomeSection(id: string): Promise<AdminHomeSection | null> {
  const row = await queryOne<SectionRow>(
    `${SECTION_SELECT} WHERE s.id = $1 AND s.deleted_at IS NULL`,
    [id],
  );
  return row === null ? null : toAdminSection(row);
}

/**
 * The storefront read.
 *
 * One query for the sections, then one product query per section, run together.
 * That is deliberately not a single join: each kind resolves its products by a
 * different rule, and the alternative — a hand-rolled UNION that re-implements
 * the catalogue's price, stock and image joins — is exactly the drift
 * `listPublishedProductsByIds` exists to prevent. The count is bounded by how
 * many sections the CEO has configured, and they run in parallel.
 *
 * A section that resolves to nothing is dropped. An empty heading on the home
 * page reads as a broken shop, and the reason it is empty (an unpublished
 * product, a deactivated category) is never something a shopper can act on.
 */
export async function listHomeSections(): Promise<HomeSection[]> {
  const rows = await query<SectionRow>(
    `${SECTION_SELECT}
      WHERE s.deleted_at IS NULL AND s.is_active
      ORDER BY s.sort_order, s.title`,
  );

  const sections = await Promise.all(rows.map(resolveSection));
  return sections.filter((section): section is HomeSection => section !== null);
}

async function resolveSection(row: SectionRow): Promise<HomeSection | null> {
  const limit = row.max_items;
  let products: CatalogueListItem[];
  let browseHref: string | null = null;

  if (row.kind === "category") {
    if (row.source_slug === null) return null;
    ({ products } = await listPublishedProducts({ categorySlug: row.source_slug, limit }));
    browseHref = `/shop?category=${encodeURIComponent(row.source_slug)}`;
  } else if (row.kind === "brand") {
    if (row.source_slug === null) return null;
    ({ products } = await listPublishedProducts({ brandSlug: row.source_slug, limit }));
    browseHref = `/shop?brand=${encodeURIComponent(row.source_slug)}`;
  } else {
    const picked = await query<{ product_id: string }>(
      `SELECT product_id FROM home_section_product
        WHERE section_id = $1 ORDER BY sort_order, added_at LIMIT $2`,
      [row.id, limit],
    );
    products = await listPublishedProductsByIds(picked.map((entry) => entry.product_id));
  }

  if (products.length === 0) return null;
  return {
    id: row.id,
    kind: row.kind,
    layout: row.layout,
    title: row.title,
    subtitle: row.subtitle,
    browseHref,
    products,
  };
}

export class InvalidSectionSourceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidSectionSourceError";
  }
}

export type HomeSectionInput = {
  kind: HomeSectionKind;
  layout: HomeSectionLayout;
  title: string;
  subtitle: string | null;
  categoryId: string | null;
  brandId: string | null;
  maxItems: number;
  sortOrder: number;
};

/**
 * Normalises the reference to the one the kind allows.
 *
 * The database CHECK is the guarantee; this is what turns a violation into a
 * message a staff member can act on instead of a driver error, and it clears the
 * stale reference left behind when someone switches a section's kind.
 */
function referencesFor(input: HomeSectionInput): {
  categoryId: string | null;
  brandId: string | null;
} {
  if (input.kind === "category") {
    if (input.categoryId === null) {
      throw new InvalidSectionSourceError("Choose the category this section shows.");
    }
    return { categoryId: input.categoryId, brandId: null };
  }
  if (input.kind === "brand") {
    if (input.brandId === null) {
      throw new InvalidSectionSourceError("Choose the brand this section shows.");
    }
    return { categoryId: null, brandId: input.brandId };
  }
  return { categoryId: null, brandId: null };
}

export async function createHomeSection(input: HomeSectionInput, actor: { staffId: string }) {
  const references = referencesFor(input);
  return withTransaction(async (tx) => {
    const result = await tx.query(
      `INSERT INTO home_section
         (kind, layout, title, subtitle, category_id, brand_id, max_items, sort_order,
          created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)
       RETURNING id`,
      [
        input.kind,
        input.layout,
        input.title,
        input.subtitle,
        references.categoryId,
        references.brandId,
        input.maxItems,
        input.sortOrder,
        actor.staffId,
      ],
    );
    const id = (result.rows[0] as { id: string }).id;
    await recordAudit(tx, {
      actorType: "staff",
      actorId: actor.staffId,
      action: "home_section.created",
      entityType: "home_section",
      entityId: id,
      after: { ...input, ...references },
    });
    return id;
  });
}

export async function updateHomeSection(
  id: string,
  input: HomeSectionInput,
  actor: { staffId: string },
) {
  const references = referencesFor(input);
  return withTransaction(async (tx) => {
    const before = await tx.query(
      `SELECT kind, layout, title, subtitle, category_id, brand_id, max_items, sort_order
         FROM home_section WHERE id = $1 AND deleted_at IS NULL`,
      [id],
    );
    if (before.rows.length === 0) return false;

    await tx.query(
      `UPDATE home_section
          SET kind = $2, layout = $3, title = $4, subtitle = $5, category_id = $6,
              brand_id = $7, max_items = $8, sort_order = $9,
              updated_at = now(), updated_by = $10
        WHERE id = $1`,
      [
        id,
        input.kind,
        input.layout,
        input.title,
        input.subtitle,
        references.categoryId,
        references.brandId,
        input.maxItems,
        input.sortOrder,
        actor.staffId,
      ],
    );

    // Changing away from a collection leaves its picks unreachable but intact,
    // so switching kind by accident and switching back does not lose the list.
    await recordAudit(tx, {
      actorType: "staff",
      actorId: actor.staffId,
      action: "home_section.updated",
      entityType: "home_section",
      entityId: id,
      before: before.rows[0],
      after: { ...input, ...references },
    });
    return true;
  });
}

export async function setHomeSectionActive(
  id: string,
  isActive: boolean,
  actor: { staffId: string },
) {
  await withTransaction(async (tx) => {
    await tx.query(
      "UPDATE home_section SET is_active = $2, updated_at = now(), updated_by = $3 WHERE id = $1",
      [id, isActive, actor.staffId],
    );
    await recordAudit(tx, {
      actorType: "staff",
      actorId: actor.staffId,
      action: isActive ? "home_section.activated" : "home_section.deactivated",
      entityType: "home_section",
      entityId: id,
      after: { isActive },
    });
  });
}

export async function softDeleteHomeSection(
  id: string,
  reason: string,
  actor: { staffId: string },
) {
  await withTransaction(async (tx) => {
    await tx.query(
      `UPDATE home_section
          SET deleted_at = now(), deleted_by = $2, deleted_reason = $3, is_active = false
        WHERE id = $1 AND deleted_at IS NULL`,
      [id, actor.staffId, reason],
    );
    await recordAudit(tx, {
      actorType: "staff",
      actorId: actor.staffId,
      action: "home_section.deleted",
      entityType: "home_section",
      entityId: id,
      after: { reason },
    });
  });
}

/**
 * Moves a section one place up or down.
 *
 * Swaps `sort_order` with its neighbour inside one transaction rather than
 * rewriting every row, so two staff reordering at once cannot interleave into a
 * arrangement neither of them chose.
 */
export async function moveHomeSection(
  id: string,
  direction: "up" | "down",
  actor: { staffId: string },
): Promise<boolean> {
  return withTransaction(async (tx) => {
    const current = await tx.query(
      "SELECT sort_order, title FROM home_section WHERE id = $1 AND deleted_at IS NULL",
      [id],
    );
    const row = current.rows[0] as { sort_order: number; title: string } | undefined;
    if (row === undefined) return false;

    const comparison = direction === "up" ? "<" : ">";
    const order = direction === "up" ? "DESC" : "ASC";
    const neighbour = await tx.query(
      `SELECT id, sort_order FROM home_section
        WHERE deleted_at IS NULL
          AND (sort_order, title) ${comparison} ($1, $2)
        ORDER BY sort_order ${order}, title ${order}
        LIMIT 1`,
      [row.sort_order, row.title],
    );
    const other = neighbour.rows[0] as { id: string; sort_order: number } | undefined;
    if (other === undefined) return false;

    // Equal sort_order values are legal, so a plain swap can be a no-op. Nudging
    // the pair apart guarantees the move is visible.
    const [nextForCurrent, nextForOther] =
      row.sort_order === other.sort_order
        ? direction === "up"
          ? [other.sort_order - 1, other.sort_order]
          : [other.sort_order + 1, other.sort_order]
        : [other.sort_order, row.sort_order];

    await tx.query("UPDATE home_section SET sort_order = $2, updated_at = now() WHERE id = $1", [
      id,
      nextForCurrent,
    ]);
    await tx.query("UPDATE home_section SET sort_order = $2, updated_at = now() WHERE id = $1", [
      other.id,
      nextForOther,
    ]);
    await recordAudit(tx, {
      actorType: "staff",
      actorId: actor.staffId,
      action: "home_section.reordered",
      entityType: "home_section",
      entityId: id,
      before: { sortOrder: row.sort_order },
      after: { sortOrder: nextForCurrent, direction },
    });
    return true;
  });
}

// ---------------------------------------------------------------------------
// Collection membership — "where does this product land on the public site".
// ---------------------------------------------------------------------------

/** Every collection, for the checkbox list on the product form. */
export async function listCollections(): Promise<{ id: string; title: string }[]> {
  return query<{ id: string; title: string }>(
    `SELECT id, title FROM home_section
      WHERE kind = 'collection' AND deleted_at IS NULL
      ORDER BY sort_order, title`,
  );
}

export async function listCollectionIdsForProduct(productId: string): Promise<string[]> {
  const rows = await query<{ section_id: string }>(
    `SELECT hsp.section_id
       FROM home_section_product hsp
       JOIN home_section s ON s.id = hsp.section_id AND s.deleted_at IS NULL
      WHERE hsp.product_id = $1`,
    [productId],
  );
  return rows.map((row) => row.section_id);
}

/**
 * Replaces a product's collection membership with exactly `sectionIds`.
 *
 * Deletes then inserts inside one transaction, which is safe to run twice — a
 * CockroachDB transaction can be retried by the server, so the body must be
 * idempotent (AGENTS.md §3).
 */
export async function setProductCollections(
  productId: string,
  sectionIds: string[],
  actor: { staffId: string },
): Promise<void> {
  await withTransaction(async (tx) => {
    const before = await tx.query(
      "SELECT section_id FROM home_section_product WHERE product_id = $1",
      [productId],
    );
    await tx.query("DELETE FROM home_section_product WHERE product_id = $1", [productId]);

    if (sectionIds.length > 0) {
      await tx.query(
        `INSERT INTO home_section_product (section_id, product_id, added_by)
         SELECT s.id, $2, $3
           FROM home_section s
          WHERE s.id = ANY($1::UUID[]) AND s.kind = 'collection' AND s.deleted_at IS NULL`,
        [sectionIds, productId, actor.staffId],
      );
    }

    await recordAudit(tx, {
      actorType: "staff",
      actorId: actor.staffId,
      action: "product.collections_changed",
      entityType: "product",
      entityId: productId,
      before: (before.rows as { section_id: string }[]).map((entry) => entry.section_id),
      after: sectionIds,
    });
  });
}

/** The members of one collection, in display order, for its admin screen. */
export async function listCollectionMembers(sectionId: string) {
  return query<{ id: string; name: string; status: string; sort_order: number }>(
    `SELECT p.id, p.name, p.status, hsp.sort_order
       FROM home_section_product hsp
       JOIN product p ON p.id = hsp.product_id AND p.deleted_at IS NULL
      WHERE hsp.section_id = $1
      ORDER BY hsp.sort_order, hsp.added_at`,
    [sectionId],
  );
}
