/**
 * Turning a wall-clock time a customer typed into the instant it names.
 *
 * A `datetime-local` input hands back "2026-09-10T14:30" with no offset. Parsing
 * that with `new Date()` resolves it against *the server's* timezone, so a slot
 * a customer in Lagos meant as half past two becomes half past two UTC on a
 * server in London — an hour out, silently, and only on the orders where being
 * an hour out matters.
 *
 * Nigeria is UTC+1 all year and has never observed daylight saving, so the
 * offset is a constant rather than a lookup. It is written once, here, with this
 * note attached, instead of being rediscovered at each call site.
 */
const LAGOS_OFFSET_MINUTES = 60;

/** How far ahead a customer may schedule a collection. Beyond this is a typo. */
const MAX_DAYS_AHEAD = 60;

/**
 * `null` for anything that is not a usable slot — absent, unparseable, in the
 * past, or implausibly far ahead. A refusal rather than a best guess: a
 * collection time the shop will wait through is worth getting wrong loudly.
 */
export function lagosLocalToInstant(
  local: string | null | undefined,
  now = new Date(),
): Date | null {
  if (typeof local !== "string") return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local.trim());
  if (match === null) return null;

  const [year, month, day, hour, minute] = match.slice(1).map(Number) as [
    number,
    number,
    number,
    number,
    number,
  ];

  const asUtc = Date.UTC(year, month - 1, day, hour, minute);
  // Round-tripped to catch a date the calendar does not have: Date.UTC happily
  // rolls 31 February into 3 March, and a slot the customer never chose is worse
  // than no slot.
  const rolled = new Date(asUtc);
  if (rolled.getUTCMonth() !== month - 1 || rolled.getUTCDate() !== day) return null;

  const instant = new Date(asUtc - LAGOS_OFFSET_MINUTES * 60_000);
  if (instant.getTime() < now.getTime()) return null;
  if (instant.getTime() > now.getTime() + MAX_DAYS_AHEAD * 86_400_000) return null;
  return instant;
}

/** §6: stored UTC, read back in Africa/Lagos. */
export function formatLagos(value: Date): string {
  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Lagos",
  }).format(value);
}
