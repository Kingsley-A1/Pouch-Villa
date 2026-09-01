/**
 * Nigerian mobile numbers, normalised to one canonical form.
 *
 * This matters more here than phone handling usually does. ADR 0002 makes the
 * customer's email a contact channel rather than an identity proof, and
 * authorises order tracking by **order reference plus registered phone**. That
 * makes the phone security-bearing: if the same person's number can be stored in
 * three shapes, then two of those shapes fail to open their own order, and a
 * customer who typed their number with spaces is locked out of tracking a
 * delivery they have already paid for.
 *
 * So every number is stored canonically and every comparison is made against the
 * canonical form, never against what was typed.
 *
 * Canonical form is the E.164 one: a plus, the country code, then the ten-digit
 * national number with its trunk zero removed.
 */

const COUNTRY_CODE = "234";
const NATIONAL_LENGTH = 10;

/**
 * Nigerian mobile numbers begin 7, 8 or 9 once the trunk zero is off. Landlines
 * do not, and a landline is not reachable for the delivery coordination this
 * number exists for, so it is refused at the boundary rather than accepted and
 * discovered on the day.
 */
const MOBILE_LEADING_DIGITS = new Set(["7", "8", "9"]);

export class InvalidPhoneNumberError extends Error {
  constructor() {
    super("Enter a Nigerian mobile number.");
    this.name = "InvalidPhoneNumberError";
  }
}

/**
 * Accepts every shape a customer actually types — with or without the country
 * code, with or without the trunk zero, with spaces, hyphens or brackets — and
 * returns the canonical form, or null if it cannot be one.
 *
 * Returning null rather than throwing lets a caller decide whether a bad number
 * is a validation message on a form or a rejected API request.
 */
export function normalisePhone(input: string): string | null {
  const trimmed = input.trim();
  if (trimmed === "") return null;

  const digits = trimmed.replace(/\D/g, "");
  if (digits === "") return null;

  let national: string;
  if (digits.startsWith(COUNTRY_CODE) && digits.length === COUNTRY_CODE.length + NATIONAL_LENGTH) {
    national = digits.slice(COUNTRY_CODE.length);
  } else if (digits.startsWith("0") && digits.length === NATIONAL_LENGTH + 1) {
    national = digits.slice(1);
  } else if (digits.length === NATIONAL_LENGTH) {
    national = digits;
  } else {
    return null;
  }

  const leading = national.slice(0, 1);
  if (!MOBILE_LEADING_DIGITS.has(leading)) return null;

  return `+${COUNTRY_CODE}${national}`;
}

export function assertPhone(input: string): string {
  const normalised = normalisePhone(input);
  if (normalised === null) throw new InvalidPhoneNumberError();
  return normalised;
}

export function isPhone(input: string): boolean {
  return normalisePhone(input) !== null;
}

/**
 * The local form, for display. Staff read these off a screen to dial them, and
 * the international form is not what anyone here reads aloud.
 */
export function formatPhoneLocal(canonical: string): string {
  const national = canonical.startsWith(`+${COUNTRY_CODE}`)
    ? canonical.slice(COUNTRY_CODE.length + 1)
    : canonical;
  if (national.length !== NATIONAL_LENGTH) return canonical;
  return `0${national.slice(0, 3)} ${national.slice(3, 6)} ${national.slice(6)}`;
}

/**
 * Masks all but the last three digits, for anywhere a number is shown to
 * confirm identity without disclosing it — the tracking page's "we have a
 * number ending 123 on this order" line.
 */
export function maskPhone(canonical: string): string {
  const visible = canonical.slice(-3);
  return `${"•".repeat(4)} ${visible}`;
}
