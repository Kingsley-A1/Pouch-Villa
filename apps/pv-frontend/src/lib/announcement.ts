/**
 * The name of the cookie recording that a visitor closed the announcement bar.
 *
 * It lives in `lib/` rather than beside the server-side read in
 * `server/announcement.ts` because both sides need it: the server reads the
 * cookie before the first paint, and the close button writes it in the browser.
 * `server/announcement.ts` imports `next/headers`, which cannot be pulled into
 * a Client Component — so the shared constant has to sit somewhere neither side
 * has to reach through the other to get at.
 */
export const ANNOUNCEMENT_DISMISSED_COOKIE = "pv_announcement_seen";
