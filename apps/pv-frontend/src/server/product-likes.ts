import { likeCountsFor, likedIdsFor } from "@pv/backend/services/likes";
import type { CatalogueListItem } from "@pv/backend/services/catalogue";
import { resolveExistingLikeActor } from "./like-session";

/** What a card needs to render its heart: how many, and whether this is one. */
export type LikeSummary = Map<string, { count: number; liked: boolean }>;

/**
 * Like state for a whole grid, in at most two queries.
 *
 * Lives here rather than in `ProductGrid` because components under
 * `src/components` are presentational and do not fetch (AGENTS.md §7). Pages
 * call this once and hand the result down, which also means a page that does not
 * want hearts pays nothing for them.
 *
 * A visitor who has never liked anything has no cookie and therefore no actor,
 * so the second query is skipped entirely — the common case for a first visit is
 * one query, not two.
 */
export async function likeSummaryFor(products: CatalogueListItem[]): Promise<LikeSummary> {
  if (products.length === 0) return new Map();
  const ids = products.map((product) => product.id);

  const actor = await resolveExistingLikeActor();
  const [counts, likedIds] = await Promise.all([
    likeCountsFor(ids),
    actor === null ? Promise.resolve(new Set<string>()) : likedIdsFor(ids, actor),
  ]);

  return new Map(ids.map((id) => [id, { count: counts.get(id) ?? 0, liked: likedIds.has(id) }]));
}
