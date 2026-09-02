/**
 * Turning a stored name into something the storefront can greet someone by.
 *
 * The customer record holds one free-text `full_name` that the person typed
 * themselves, or that Google supplied — never a structured first/last pair. So
 * "what do we call this person" is a real decision with real failure modes, and
 * it belongs here as a pure function with tests rather than as an inline
 * `split(" ")[0]` repeated in four components.
 *
 * The rules, in order:
 *   - A name is used if there is one.
 *   - Otherwise the local part of the email, which is the only other thing we
 *     hold. It is a guess about a person's name, so it is only ever used where
 *     the wording survives being wrong ("Hi, kingsley" reads fine; a receipt
 *     addressed that way would not).
 *   - `null` when neither yields anything, so the caller has to decide what an
 *     unnamed customer sees instead of rendering an empty greeting.
 */

/** Collapses runs of whitespace so " Ada   Obi " and "Ada Obi" behave alike. */
function tidy(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/** The whole name as given, or `null` when nothing usable was stored. */
export function displayName(fullName: string | null): string | null {
  if (fullName === null) return null;
  const tidied = tidy(fullName);
  return tidied === "" ? null : tidied;
}

/**
 * The single word to greet someone by.
 *
 * Deliberately the *first* word, not a guess at a given name: Nigerian names are
 * written in more than one order, and the first word is what the person chose to
 * lead with. A one-word name greets as itself.
 */
export function firstName(fullName: string | null): string | null {
  const name = displayName(fullName);
  if (name === null) return null;
  return name.split(" ")[0] ?? null;
}

/**
 * A greeting name, falling back to the email's local part.
 *
 * The fallback is capped so a long address cannot push a heading off a 360 px
 * screen, and it is only a fallback — a stored name always wins.
 */
export function greetingName(fullName: string | null, email: string): string | null {
  const fromName = firstName(fullName);
  if (fromName !== null) return fromName;

  const local = tidy(email.split("@")[0] ?? "");
  if (local === "") return null;
  return local.length > 24 ? local.slice(0, 24) : local;
}

/**
 * Up to two initials for an avatar.
 *
 * Falls back to the first letter of the email, and to `null` only when there is
 * no letter or digit anywhere — at which point the caller should draw an icon
 * rather than an empty circle.
 */
export function initials(fullName: string | null, email: string): string | null {
  const name = displayName(fullName);
  const words = name === null ? [] : name.split(" ").filter((word) => /[\p{L}\p{N}]/u.test(word));

  if (words.length > 0) {
    const first = words[0]?.[0] ?? "";
    const last = words.length > 1 ? (words[words.length - 1]?.[0] ?? "") : "";
    const letters = `${first}${last}`.toUpperCase();
    if (letters !== "") return letters;
  }

  const fromEmail = email.trim()[0];
  return fromEmail === undefined ? null : fromEmail.toUpperCase();
}
