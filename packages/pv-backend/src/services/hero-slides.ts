import { query, queryOne } from "../db/client";
import { withTransaction } from "../db/transaction";
import { isStorageConfigured, publicUrl } from "../storage/r2";
import { catalogueMediaKey } from "../storage/media-key";
import { recordAudit } from "./audit";

/**
 * The slide deck at the top of the home page.
 *
 * The client asked for the shop to open the way the reference site does: a
 * full-bleed photograph, a heavy headline over it, a Shop Now button, and two or
 * three of them on a timer. This is where those live.
 *
 * A slide is editorial and not taxonomy — see `migrations/0013_hero_slide.sql`
 * for why it is its own table rather than a column on `category`. The shape is
 * deliberately the same as `home-sections.ts`: the CEO orders them, activates
 * and deactivates them, and nothing is ever hard-deleted.
 */

export type AdminHeroSlide = {
  id: string;
  kicker: string | null;
  headline: string;
  href: string;
  ctaLabel: string | null;
  image: { url: string; width: number; height: number } | null;
  sortOrder: number;
  isActive: boolean;
};

/** A slide the storefront can actually render: it has a photograph. */
export type HeroSlide = Omit<AdminHeroSlide, "image" | "isActive" | "sortOrder"> & {
  image: { url: string; width: number; height: number };
};

type SlideRow = {
  id: string;
  kicker: string | null;
  headline: string;
  href: string;
  cta_label: string | null;
  image_hash: string | null;
  /** `INT` columns, so strings off the wire. */
  image_width: string | null;
  image_height: string | null;
  /** `INT` too, and for the same reason. Coerced in `toAdminSlide`. */
  sort_order: string;
  is_active: boolean;
};

const SLIDE_SELECT = `
  SELECT id, kicker, headline, href, cta_label,
         image_hash, image_width, image_height, sort_order, is_active
    FROM hero_slide
`;

/**
 * One rendition serves the slide. The hero is the widest element on the page and
 * is rendered at the largest derivative; asking for a thumb of it would be
 * storage spent on a size nothing displays.
 */
function slideImage(
  id: string,
  hash: string | null,
  width: string | null,
  height: string | null,
): { url: string; width: number; height: number } | null {
  if (hash === null || width === null || height === null || !isStorageConfigured()) return null;
  return {
    url: publicUrl(catalogueMediaKey("hero", id, hash, "hero")),
    width: Number(width),
    height: Number(height),
  };
}

function toAdminSlide(row: SlideRow): AdminHeroSlide {
  return {
    id: row.id,
    kicker: row.kicker,
    headline: row.headline,
    href: row.href,
    ctaLabel: row.cta_label,
    image: slideImage(row.id, row.image_hash, row.image_width, row.image_height),
    // The driver hands INT columns back as strings. Left alone the declared
    // `number` is a lie the compiler cannot see, and the reorder controls end up
    // comparing "10" against "9" as text.
    sortOrder: Number(row.sort_order),
    isActive: row.is_active,
  };
}

/** Includes inactive slides and slides with no picture yet — the admin manages both. */
export async function listAllHeroSlides(): Promise<AdminHeroSlide[]> {
  const rows = await query<SlideRow>(
    `${SLIDE_SELECT} WHERE deleted_at IS NULL ORDER BY sort_order, created_at`,
  );
  return rows.map(toAdminSlide);
}

export async function getHeroSlide(id: string): Promise<AdminHeroSlide | null> {
  const row = await queryOne<SlideRow>(`${SLIDE_SELECT} WHERE id = $1 AND deleted_at IS NULL`, [
    id,
  ]);
  return row === null ? null : toAdminSlide(row);
}

/**
 * What the storefront renders.
 *
 * A slide without a photograph is filtered out here rather than rendered as a
 * headline on an empty box. That is §0 rule 2 applied to the largest element on
 * the page: a half-built slide is more damaging than one fewer slide, and the
 * home page falls back to the CEO's headline when this returns nothing at all.
 */
export async function listHeroSlides(): Promise<HeroSlide[]> {
  const rows = await query<SlideRow>(
    `${SLIDE_SELECT}
      WHERE deleted_at IS NULL AND is_active AND image_hash IS NOT NULL
      ORDER BY sort_order, created_at`,
  );
  return rows.flatMap((row) => {
    const image = slideImage(row.id, row.image_hash, row.image_width, row.image_height);
    if (image === null) return [];
    return [
      {
        id: row.id,
        kicker: row.kicker,
        headline: row.headline,
        href: row.href,
        ctaLabel: row.cta_label,
        image,
      },
    ];
  });
}

export type HeroSlideInput = {
  kicker: string | null;
  headline: string;
  href: string;
  ctaLabel: string | null;
  sortOrder: number;
};

export async function createHeroSlide(input: HeroSlideInput, actor: { staffId: string }) {
  return withTransaction(async (tx) => {
    const result = await tx.query(
      `INSERT INTO hero_slide (kicker, headline, href, cta_label, sort_order, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $6)
       RETURNING id`,
      [input.kicker, input.headline, input.href, input.ctaLabel, input.sortOrder, actor.staffId],
    );
    const id = (result.rows[0] as { id: string }).id;
    await recordAudit(tx, {
      actorType: "staff",
      actorId: actor.staffId,
      action: "hero_slide.created",
      entityType: "hero_slide",
      entityId: id,
      after: { ...input },
    });
    return id;
  });
}

export async function updateHeroSlide(
  id: string,
  input: HeroSlideInput,
  actor: { staffId: string },
) {
  return withTransaction(async (tx) => {
    const before = await tx.query(
      "SELECT kicker, headline, href, cta_label, sort_order FROM hero_slide WHERE id = $1 AND deleted_at IS NULL",
      [id],
    );
    if (before.rows.length === 0) return false;

    await tx.query(
      `UPDATE hero_slide
          SET kicker = $2, headline = $3, href = $4, cta_label = $5, sort_order = $6,
              updated_at = now(), updated_by = $7
        WHERE id = $1`,
      [
        id,
        input.kicker,
        input.headline,
        input.href,
        input.ctaLabel,
        input.sortOrder,
        actor.staffId,
      ],
    );
    await recordAudit(tx, {
      actorType: "staff",
      actorId: actor.staffId,
      action: "hero_slide.updated",
      entityType: "hero_slide",
      entityId: id,
      before: before.rows[0],
      after: { ...input },
    });
    return true;
  });
}

export async function setHeroSlideActive(
  id: string,
  isActive: boolean,
  actor: { staffId: string },
) {
  await withTransaction(async (tx) => {
    await tx.query(
      "UPDATE hero_slide SET is_active = $2, updated_at = now(), updated_by = $3 WHERE id = $1",
      [id, isActive, actor.staffId],
    );
    await recordAudit(tx, {
      actorType: "staff",
      actorId: actor.staffId,
      action: isActive ? "hero_slide.activated" : "hero_slide.deactivated",
      entityType: "hero_slide",
      entityId: id,
      after: { isActive },
    });
  });
}

/** §6: nothing is hard-deleted, and a removal records who and why. */
export async function softDeleteHeroSlide(id: string, reason: string, actor: { staffId: string }) {
  await withTransaction(async (tx) => {
    await tx.query(
      `UPDATE hero_slide
          SET deleted_at = now(), deleted_by = $2, deleted_reason = $3
        WHERE id = $1 AND deleted_at IS NULL`,
      [id, actor.staffId, reason],
    );
    await recordAudit(tx, {
      actorType: "staff",
      actorId: actor.staffId,
      action: "hero_slide.deleted",
      entityType: "hero_slide",
      entityId: id,
      after: { reason },
    });
  });
}

/**
 * Swaps a slide with its neighbour.
 *
 * Positions are swapped rather than recomputed for the whole list, so two people
 * reordering at once cannot collapse every slide onto the same `sort_order`.
 * Both rows are read and written inside one transaction for the same reason.
 */
export async function moveHeroSlide(
  id: string,
  direction: "up" | "down",
  actor: { staffId: string },
): Promise<boolean> {
  return withTransaction(async (tx) => {
    const current = await tx.query(
      "SELECT sort_order FROM hero_slide WHERE id = $1 AND deleted_at IS NULL",
      [id],
    );
    const row = current.rows[0] as { sort_order: string } | undefined;
    if (row === undefined) return false;

    const neighbour =
      direction === "up"
        ? await tx.query(
            `SELECT id, sort_order FROM hero_slide
              WHERE deleted_at IS NULL AND sort_order < $1
              ORDER BY sort_order DESC LIMIT 1`,
            [row.sort_order],
          )
        : await tx.query(
            `SELECT id, sort_order FROM hero_slide
              WHERE deleted_at IS NULL AND sort_order > $1
              ORDER BY sort_order ASC LIMIT 1`,
            [row.sort_order],
          );

    const other = neighbour.rows[0] as { id: string; sort_order: string } | undefined;
    if (other === undefined) return false;

    await tx.query(
      "UPDATE hero_slide SET sort_order = $2, updated_at = now(), updated_by = $3 WHERE id = $1",
      [id, other.sort_order, actor.staffId],
    );
    await tx.query(
      "UPDATE hero_slide SET sort_order = $2, updated_at = now(), updated_by = $3 WHERE id = $1",
      [other.id, row.sort_order, actor.staffId],
    );

    await recordAudit(tx, {
      actorType: "staff",
      actorId: actor.staffId,
      action: "hero_slide.reordered",
      entityType: "hero_slide",
      entityId: id,
      before: { sortOrder: Number(row.sort_order) },
      after: { sortOrder: Number(other.sort_order) },
    });
    return true;
  });
}
