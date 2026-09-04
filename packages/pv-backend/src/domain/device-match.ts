/**
 * Recognising a device inside something a shopper typed into search.
 *
 * Pure, and run over the device list the catalogue already loads, so the search
 * page gets device matching without a second query.
 *
 * There used to be a second function here, `filterDevices`, backing a typeahead
 * in the device finder. The finder is now a brand select and a model select, so
 * nothing narrows a device list by typed text any more and the function went
 * with it.
 */

export type DeviceLike = { slug: string; name: string; brandName: string };

/**
 * Splits text into comparable tokens.
 *
 * Two normalisations do the real work here. Non-alphanumerics become breaks, so
 * "Galaxy S23+" and "Galaxy S23 Plus" tokenise alike up to the last word. And a
 * letter/digit boundary is itself a break, so "iphone13" and "iPhone 13" produce
 * the same tokens — people type model names both ways, and on a phone keyboard
 * the space is the character most often dropped.
 */
export function tokenise(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/([a-z])(\d)/g, "$1 $2")
    .replace(/(\d)([a-z])/g, "$1 $2")
    .split(" ")
    .filter((token) => token !== "");
}

/**
 * Finds a model inside a sentence a shopper typed into search.
 *
 * "clear case for iphone 13 pro" is the shape of a real query, and no amount of
 * full-text ranking on product names will connect it to a case whose name never
 * says "iPhone" — the compatibility table holds that fact, not the product row.
 *
 * The rule is deliberately strict: the device's own model tokens must appear
 * **contiguously and in order** within the query. Requiring whole tokens is what
 * stops a device called "A5" from claiming a query about an A54, and requiring
 * them to be adjacent is what stops "13" and "pro" landing in the query for
 * unrelated reasons and being read as a model.
 *
 * The most specific match wins, so "iPhone 13 Pro" beats "iPhone 13" on a query
 * that names the Pro.
 */
export function findDeviceInPhrase<T extends DeviceLike>(
  phrase: string,
  devices: readonly T[],
): T | null {
  const words = tokenise(phrase);
  if (words.length === 0) return null;

  let best: { device: T; specificity: number } | null = null;
  for (const device of devices) {
    const model = tokenise(device.name);
    // A single-token model name is too weak to recognise in a sentence on its
    // own — "Pro" or "Ultra" would match half the queries in the shop — so it
    // only counts when the brand is named alongside it.
    const needsBrand = model.length < 2;
    if (model.length === 0) continue;
    if (!containsRun(words, model)) continue;
    if (needsBrand && !containsRun(words, tokenise(device.brandName))) continue;

    const specificity = model.length;
    if (best === null || specificity > best.specificity) best = { device, specificity };
  }
  return best === null ? null : best.device;
}

/** Whether `run` appears as a contiguous, in-order slice of `words`. */
function containsRun(words: readonly string[], run: readonly string[]): boolean {
  if (run.length === 0 || run.length > words.length) return false;
  for (let start = 0; start <= words.length - run.length; start += 1) {
    let matched = true;
    for (let offset = 0; offset < run.length; offset += 1) {
      if (words[start + offset] !== run[offset]) {
        matched = false;
        break;
      }
    }
    if (matched) return true;
  }
  return false;
}
