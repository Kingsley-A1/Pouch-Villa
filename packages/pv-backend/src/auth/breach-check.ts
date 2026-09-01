import { createHash } from "node:crypto";

/**
 * Checks a password against the Have I Been Pwned corpus, per AGENTS.md §5.
 *
 * **The password never leaves this process.** The range API takes the first five
 * hex characters of the password's SHA-1 and returns every suffix it holds under
 * that prefix — typically several hundred. The comparison happens locally. HIBP
 * learns five characters of a hash, which identifies roughly one in a million
 * passwords and tells it nothing about whose.
 *
 * **This fails open, deliberately.** If HIBP is unreachable, slow, or returns
 * something unexpected, the password is accepted. Refusing a known-breached
 * password is a real improvement over not checking; making a Nigerian customer's
 * account creation depend on a foreign API's uptime is not. The failure is
 * logged — without the password, the hash, or the account.
 */

const RANGE_ENDPOINT = "https://api.pwnedpasswords.com/range";
const PREFIX_LENGTH = 5;
const TIMEOUT_MS = 2_000;

export type BreachResult =
  | { checked: true; breached: false }
  | { checked: true; breached: true; occurrences: number }
  /** The check could not be completed. The caller accepts the password. */
  | { checked: false };

export class BreachedPasswordError extends Error {
  constructor() {
    // Deliberately vague about the source and the count. The user needs to know
    // to pick another password, not to be lectured about which breach.
    super("That password has appeared in a public data breach. Please choose a different one.");
    this.name = "BreachedPasswordError";
  }
}

export async function checkPasswordBreached(
  password: string,
  fetchImpl: typeof fetch = fetch,
): Promise<BreachResult> {
  const digest = createHash("sha1").update(password, "utf8").digest("hex").toUpperCase();
  const prefix = digest.slice(0, PREFIX_LENGTH);
  const suffix = digest.slice(PREFIX_LENGTH);

  let body: string;
  try {
    const response = await fetchImpl(`${RANGE_ENDPOINT}/${prefix}`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { "Add-Padding": "true" },
    });
    if (!response.ok) return { checked: false };
    body = await response.text();
  } catch {
    // Network failure, DNS failure, timeout, abort. All the same answer.
    return { checked: false };
  }

  for (const line of body.split("\n")) {
    const separator = line.indexOf(":");
    if (separator === -1) continue;
    if (line.slice(0, separator).trim().toUpperCase() !== suffix) continue;
    const occurrences = Number.parseInt(line.slice(separator + 1).trim(), 10);
    // Padding entries are returned with a count of zero and must not be treated
    // as a hit; they exist precisely so the response size reveals nothing.
    if (!Number.isFinite(occurrences) || occurrences <= 0)
      return { checked: true, breached: false };
    return { checked: true, breached: true, occurrences };
  }

  return { checked: true, breached: false };
}

/**
 * The form callers use when setting or changing a password. Throws only on a
 * confirmed breach; an unreachable service is not the user's problem.
 */
export async function assertPasswordNotBreached(
  password: string,
  fetchImpl: typeof fetch = fetch,
): Promise<BreachResult> {
  const result = await checkPasswordBreached(password, fetchImpl);
  if (result.checked && result.breached) throw new BreachedPasswordError();
  if (!result.checked) {
    console.warn("Password breach check unavailable; password accepted without it.");
  }
  return result;
}
