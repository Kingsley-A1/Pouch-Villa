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
