import { catalogueMediaKey, type CatalogueMediaOwner } from "../storage/media-key";
import { publicUrl } from "../storage/r2";

/**
 * The CDN URL for a category photograph or a brand logo.
 *
 * Split out of `catalogue-media.ts` for the same reason `media-urls.ts` is split
 * out of `media.ts`: this is called from every storefront read — the browse
 * steps and the home mosaic — and that file reaches the sharp-based processing
 * pipeline. A page rendering a brand logo must not pull a native image module
 * into its serverless function to do it.
 *
 * Only the card rendition, because a category tile and a brand card are the only
 * two places either image appears and both render at that size.
 */
export function catalogueImageUrl(
  owner: CatalogueMediaOwner,
  ownerId: string,
  contentHash: string,
): string {
  return publicUrl(catalogueMediaKey(owner, ownerId, contentHash, "card"));
}

/** What a category tile or a brand card needs in order to reserve its box. */
export type CatalogueImageRef = { url: string; width: number; height: number };

/**
 * Turns the three nullable columns a `LEFT JOIN catalogue_media` produces into a
 * typed image or a typed absence.
 *
 * All three or none: a row with a hash but no dimensions could not be rendered
 * into a reserved box, and an image that shifts the layout is worse than the
 * fallback the caller already has for a category nobody has photographed yet.
 */
export function catalogueImageFrom(
  owner: CatalogueMediaOwner,
  ownerId: string,
  contentHash: string | null | undefined,
  /** `INT` columns, which this driver hands back as strings. Coerced below. */
  width: string | number | null | undefined,
  height: string | number | null | undefined,
): CatalogueImageRef | null {
  // `undefined` as well as `null`, deliberately. A database row reaches this
  // through a cast rather than a parse, so a query that forgets to select the
  // join columns produces `undefined` — and building a URL out of that would
  // put a broken image on the page instead of the fallback.
  if (contentHash == null || width == null || height == null) return null;
  // Left alone, the declared `number` is a lie the compiler cannot see, and the
  // first caller to do arithmetic on it gets "447447" — the same trap `toImage`
  // in catalogue.ts documents.
  return {
    url: catalogueImageUrl(owner, ownerId, contentHash),
    width: Number(width),
    height: Number(height),
  };
}
