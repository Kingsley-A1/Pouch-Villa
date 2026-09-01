import { query } from "../db/client";
import { withTransaction } from "../db/transaction";
import { recordAudit } from "./audit";

/**
 * Saved views — the filters staff return to every day, kept as a query string
 * rather than a result set.
 *
 * Storing the query means a view is always current and costs nothing to
 * maintain. Storing ids would go stale the moment an order moved, which is the
 * whole point of the screens these sit on.
 */

export const VIEW_SCREENS = ["orders", "payments", "reviews", "contact", "products"] as const;
export type ViewScreen = (typeof VIEW_SCREENS)[number];

export function isViewScreen(value: string): value is ViewScreen {
  return (VIEW_SCREENS as readonly string[]).includes(value);
}

export class TooManyViewsError extends Error {
  constructor(limit: number) {
    super(`You can keep up to ${limit} saved views on one screen.`);
    this.name = "TooManyViewsError";
  }
}

export class ViewNotFoundError extends Error {
  constructor() {
    super("That saved view was not found.");
    this.name = "ViewNotFoundError";
  }
}

/** A bar of shortcuts, not a filing cabinet. Past a dozen it stops helping. */
const MAX_VIEWS_PER_SCREEN = 12;

export type SavedView = {
  id: string;
  name: string;
  query: string;
  isShared: boolean;
  /** False where the view is shared by someone else, so the UI can hide delete. */
  isOwn: boolean;
};

type ViewRow = {
  id: string;
  name: string;
  query: string;
  is_shared: boolean;
  staff_id: string;
};

/**
 * The views one staff member sees on one screen: their own, plus everything
 * shared by anyone. One query, ordered so a person's own shortcuts come first.
 */
export async function listSavedViews(screen: ViewScreen, staffId: string): Promise<SavedView[]> {
  const rows = await query<ViewRow>(
    `SELECT id, name, query, is_shared, staff_id
       FROM saved_view
      WHERE screen = $1 AND (staff_id = $2 OR is_shared)
      ORDER BY (staff_id = $2) DESC, sort_order, name`,
    [screen, staffId],
  );

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    query: row.query,
    isShared: row.is_shared,
    isOwn: row.staff_id === staffId,
  }));
}

export type SaveViewInput = {
  screen: ViewScreen;
  name: string;
  query: string;
  isShared: boolean;
};

/**
 * Saves, or updates in place where the same person already has a view of that
 * name on that screen. Saving twice under one name is a correction, not a
 * request for two identical-looking buttons.
 */
export async function saveView(input: SaveViewInput, actor: { staffId: string }): Promise<string> {
  return withTransaction(async (tx) => {
    const existing = await tx.query(
      "SELECT count(*)::STRING AS total FROM saved_view WHERE staff_id = $1 AND screen = $2",
      [actor.staffId, input.screen],
    );
    const total = Number((existing.rows[0] as { total: string }).total);

    const already = await tx.query(
      "SELECT id FROM saved_view WHERE staff_id = $1 AND screen = $2 AND name = $3",
      [actor.staffId, input.screen, input.name],
    );
    const isUpdate = already.rows.length > 0;

    if (!isUpdate && total >= MAX_VIEWS_PER_SCREEN) {
      throw new TooManyViewsError(MAX_VIEWS_PER_SCREEN);
    }

    const saved = await tx.query(
      `INSERT INTO saved_view (staff_id, screen, name, query, is_shared, sort_order)
            VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (staff_id, screen, name) DO UPDATE
            SET query = excluded.query, is_shared = excluded.is_shared
         RETURNING id`,
      [actor.staffId, input.screen, input.name, input.query, input.isShared, total],
    );
    const id = (saved.rows[0] as { id: string }).id;

    await recordAudit(tx, {
      actorType: "staff",
      actorId: actor.staffId,
      action: isUpdate ? "saved_view.updated" : "saved_view.created",
      entityType: "saved_view",
      entityId: id,
      after: { screen: input.screen, name: input.name, isShared: input.isShared },
    });

    return id;
  });
}

/**
 * Deletes a view. A person may only delete their own — a shared view belongs to
 * whoever made it, and one staff member tidying up must not remove a shortcut
 * the rest of the shop is using.
 *
 * This is a real delete rather than a soft one: §6's no-hard-delete rule protects
 * business records — products, orders, customers, reviews — and a personal
 * shortcut is none of those. Keeping deleted shortcuts forever would be clutter,
 * not an audit trail. The audit record still notes that it happened.
 */
export async function deleteSavedView(viewId: string, actor: { staffId: string }): Promise<void> {
  await withTransaction(async (tx) => {
    const removed = await tx.query(
      "DELETE FROM saved_view WHERE id = $1 AND staff_id = $2 RETURNING screen, name",
      [viewId, actor.staffId],
    );
    if (removed.rows.length === 0) throw new ViewNotFoundError();

    await recordAudit(tx, {
      actorType: "staff",
      actorId: actor.staffId,
      action: "saved_view.deleted",
      entityType: "saved_view",
      entityId: viewId,
      before: removed.rows[0],
    });
  });
}
