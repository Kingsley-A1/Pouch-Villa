/**
 * Matching what someone typed against the devices the catalogue knows about.
 *
 * Two different jobs, deliberately two functions, because they answer two
 * different questions and a single "search devices" helper would do one of them
 * badly:
 *
 *   `filterDevices`      — "I am typing a model name, narrow the list."
 *   `findDeviceInPhrase` — "This is a shopping query. Is a model hiding in it?"
 *
 * Both are pure and run over the device list the catalogue already loads, so the
 * storefront gets device matching without a new query, and the same rules apply
 * in the browser (the finder) and on the server (the search page).
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

/** Brand first, because that is how a device is spoken: "Samsung Galaxy A54". */
function labelTokens(device: DeviceLike): string[] {
  return tokenise(`${device.brandName} ${device.name}`);
}

/**
 * Typeahead. Every token typed must be the start of some token in the device's
 * brand-and-model label, in any order — so "sam a5" reaches "Samsung Galaxy A54"
 * without the shopper having to know the series name sits in between.
 *
 * Ranked by how complete the match is: a token typed in full outranks a prefix,
 * and among equals the shorter label wins, so "iPhone 13" sorts above
 * "iPhone 13 Pro Max" for someone still typing.
 */
export function filterDevices<T extends DeviceLike>(term: string, devices: readonly T[]): T[] {
  const typed = tokenise(term);
  if (typed.length === 0) return [...devices];

  const scored: { device: T; score: number; length: number }[] = [];
  for (const device of devices) {
    const tokens = labelTokens(device);
    let score = 0;
    const matchedAll = typed.every((piece) => {
      const whole = tokens.some((token) => token === piece);
      const prefix = whole || tokens.some((token) => token.startsWith(piece));
      if (whole) score += 2;
      else if (prefix) score += 1;
      return prefix;
    });
    if (matchedAll) scored.push({ device, score, length: tokens.join(" ").length });
  }

  scored.sort((a, b) => b.score - a.score || a.length - b.length);
  return scored.map((entry) => entry.device);
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
