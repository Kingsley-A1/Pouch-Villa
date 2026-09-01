import { mediaKey } from "../storage/media-key";
import { publicUrl } from "../storage/r2";
import type { DerivativeName } from "../storage/image-formats";

/**
 * Resolves a product's stored media into CDN URLs. Split out of media.ts
 * because that file also imports the sharp-based processing pipeline, and this
 * function is called from every catalogue read — the storefront home page
 * included. A page that only wants to render a product image must not pull the
 * sharp native module into its serverless function just because the type it
 * needs happens to live in the same file as processImage.
 *
 * Media predating the rendition pipeline has no content hash; those rows fall
 * back to whatever single key they were stored with rather than 404ing.
 */
export function urlsForHash(
  productId: string,
  contentHash: string | null,
  fallbackKey: string,
): Record<DerivativeName, string> {
  if (contentHash === null) {
    const url = publicUrl(fallbackKey);
    return { thumb: url, card: url, hero: url };
  }
  return {
    thumb: publicUrl(mediaKey(productId, contentHash, "thumb")),
    card: publicUrl(mediaKey(productId, contentHash, "card")),
    hero: publicUrl(mediaKey(productId, contentHash, "hero")),
  };
}
