/**
 * The R2 object key for one rendition of a product image. Pure string
 * construction, deliberately kept out of images.ts: that file imports sharp for
 * actual processing, and every storefront page that reads a catalogue image
 * only needs a key to build a URL from — it must not load the image-processing
 * native module just to render a product card.
 */
export function mediaKey(productId: string, hash: string, rendition: string) {
  return `products/${productId}/${hash}-${rendition}.webp`;
}

/**
 * What a catalogue image belongs to. A category has a photograph, a brand a
 * logo, and a hero slide its own full-bleed picture.
 *
 * The three share this key builder and the upload pipeline behind it, but not
 * their storage: a hero slide keeps its image on its own row, because
 * `catalogue_media` carries a CHECK naming exactly two owners and neither
 * Postgres nor CockroachDB will let a later migration widen it safely.
 */
export type CatalogueMediaOwner = "category" | "brand" | "hero";

/**
 * The same key shape for a category photograph or a brand logo.
 *
 * A separate prefix per owner rather than one `catalogue/` bucket, so the object
 * store stays readable by eye and the media lifecycle job (section 8) can
 * reconcile one owner at a time without parsing an id out of a shared path.
 */
export function catalogueMediaKey(
  owner: CatalogueMediaOwner,
  ownerId: string,
  hash: string,
  rendition: string,
) {
  const prefix = owner === "category" ? "categories" : owner === "brand" ? "brands" : "hero";
  return `${prefix}/${ownerId}/${hash}-${rendition}.webp`;
}
