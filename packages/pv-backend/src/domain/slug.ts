/**
 * URL slugs, derived from a name rather than typed by hand.
 *
 * Staff should not have to know what a slug is, and a hand-typed one is a
 * standing source of broken URLs and duplicate-key errors. The name is the
 * single input; this turns it into something safe for a URL and stable enough
 * to keep once assigned.
 */

export const MAX_SLUG_LENGTH = 160;

/** The Unicode combining-mark block (U+0300–U+036F), left over after NFKD. */
const COMBINING_MARKS = /[̀-ͯ]/g;

/**
 * Folds a display name down to `lowercase-with-hyphens`.
 *
 * Diacritics are decomposed and stripped rather than dropped whole, so "Café"
 * becomes "cafe" and not "caf". Anything else outside a-z0-9 collapses to a
 * single hyphen. The result may legitimately be empty — a name of only symbols
 * has no slug — and callers must handle that rather than assume a value.
 */
export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(COMBINING_MARKS, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/g, "");
}

/**
 * Picks the first free slug in the `base`, `base-2`, `base-3` … sequence.
 *
 * `taken` is the set of slugs already in use. Callers read that set inside the
 * same transaction that goes on to insert, so the check and the write cannot be
 * separated by another writer — under CockroachDB's serializable isolation a
 * losing transaction retries and re-reads rather than inserting a duplicate.
 */
export function firstFreeSlug(base: string, taken: ReadonlySet<string>): string {
  const stem = base === "" ? "item" : base;
  if (!taken.has(stem)) return stem;
  for (let suffix = 2; ; suffix += 1) {
    // Trim the stem, not the suffix: "…-2" must stay inside the column width.
    const tail = `-${suffix}`;
    const candidate = `${stem.slice(0, MAX_SLUG_LENGTH - tail.length)}${tail}`;
    if (!taken.has(candidate)) return candidate;
  }
}
