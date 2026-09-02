/**
 * Session cookie names, and nothing else.
 *
 * Deliberately importable with no cost: this module has no imports at all, so
 * the Next proxy can read a cookie name without dragging the database driver
 * into a layer that runs before every request.
 *
 * The names themselves stay in `@pv/backend` rather than being retyped in the
 * frontend, because a proxy checking for the wrong cookie name would not fail —
 * it would silently stop redirecting, which is the kind of drift nobody notices
 * until it matters.
 */

export const CUSTOMER_SESSION_COOKIE = "pv_customer_session";

/**
 * `__Host-` requires Secure, so it only applies once the app is served over
 * HTTPS. Local development uses the plain name.
 */
export function hostPrefixed(name: string, isProduction: boolean): string {
  return isProduction ? `__Host-${name}` : name;
}
