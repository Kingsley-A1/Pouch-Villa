import { randomBytes, timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";

/**
 * The short-lived cookie that carries a Google sign-in across the round trip to
 * Google and back.
 *
 * A sign-in leaves our site entirely and returns as a fresh GET from Google's
 * domain. Nothing about that request proves it belongs to the person who started
 * it, so everything the callback needs to trust has to be put somewhere the
 * browser will return to us and an attacker cannot forge. That is this cookie.
 *
 * It holds four things:
 *
 *   - `state`, matched against the `state` Google echoes back. This is what
 *     stops someone feeding a victim's browser an authorization code they
 *     obtained themselves — the classic login-CSRF against OAuth.
 *   - `nonce`, bound into the ID token by Google and checked when we verify it,
 *     so a token minted for a different flow cannot be replayed into this one.
 *   - `flow`, because three different things start a Google sign-in here and the
 *     callback must not be free to choose between them.
 *   - `next` and, for a claim, the role code — see below.
 *
 * `SameSite=Lax` rather than `Strict`, deliberately: a `Strict` cookie is not
 * sent on a cross-site navigation, which is exactly what Google's redirect back
 * is, and the callback would find nothing. `Lax` is sent on a top-level GET,
 * which is the shape of that redirect and nothing else here.
 *
 * Ten minutes. Long enough to choose an account and type a password, short
 * enough that an abandoned attempt does not sit in the browser.
 */

export const OAUTH_STATE_COOKIE = "pv_oauth";

const IS_PRODUCTION = process.env.NODE_ENV === "production";
const COOKIE_NAME = IS_PRODUCTION ? `__Host-${OAUTH_STATE_COOKIE}` : OAUTH_STATE_COOKIE;
const TTL_SECONDS = 10 * 60;

/** Which of the three sign-ins is in progress. */
export type OAuthFlow = "customer" | "staff" | "claim";

export type OAuthState = {
  state: string;
  nonce: string;
  flow: OAuthFlow;
  /** Where to land afterwards. Validated as a same-site path before use. */
  next: string;
  /**
   * The role code being redeemed, for a claim only.
   *
   * It is a credential, and putting one in a cookie deserves a reason. It is
   * typed on our page and has to survive a redirect to Google and back, and the
   * alternatives are worse: a query parameter would write it into the URL bar,
   * the browser's history and every proxy log between here and Google. The
   * cookie is `HttpOnly`, `Secure` in production, host-prefixed, and gone in ten
   * minutes — and it is cleared the moment the callback reads it.
   */
  roleCode?: string;
};

export function newOAuthSecrets(): { state: string; nonce: string } {
  return {
    state: randomBytes(32).toString("base64url"),
    nonce: randomBytes(32).toString("base64url"),
  };
}

export async function writeOAuthState(value: OAuthState): Promise<void> {
  (await cookies()).set(COOKIE_NAME, JSON.stringify(value), {
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: "lax",
    path: "/",
    maxAge: TTL_SECONDS,
  });
}

export async function readOAuthState(): Promise<OAuthState | null> {
  const raw = (await cookies()).get(COOKIE_NAME)?.value;
  if (raw === undefined) return null;
  try {
    const parsed = JSON.parse(raw) as OAuthState;
    if (typeof parsed.state !== "string" || typeof parsed.nonce !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Always called before the callback does anything, success or failure. */
export async function clearOAuthState(): Promise<void> {
  (await cookies()).delete(COOKIE_NAME);
}

/**
 * Constant-time, and length-safe.
 *
 * `timingSafeEqual` throws on a length mismatch rather than returning false, so
 * the lengths are compared first — and comparing them is not a leak, because the
 * length is fixed by `newOAuthSecrets`.
 */
export function statesMatch(fromCookie: string, fromGoogle: string | null): boolean {
  if (fromGoogle === null) return false;
  const a = Buffer.from(fromCookie);
  const b = Buffer.from(fromGoogle);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * The callback URL Google must be configured with, derived from the request.
 *
 * Built from the forwarded host rather than a setting, so a preview deployment
 * works without one — but that means the host is attacker-influenceable in
 * principle, and it is only ever used as the `redirect_uri` sent to Google.
 * Google refuses any value not on the OAuth client's allowlist, so a forged host
 * fails there rather than redirecting anybody anywhere.
 */
export async function callbackUrl(): Promise<string> {
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  const protocol = headerList.get("x-forwarded-proto") ?? (IS_PRODUCTION ? "https" : "http");
  return `${protocol}://${host}/api/v1/auth/google/callback`;
}

/**
 * Only a path on this site. A `next` an attacker can set is an open redirect,
 * and "sign in, then get sent to a convincing copy of this site" is the attack
 * that makes one worth having.
 */
export function safeNext(value: string | null, fallback: string): string {
  if (value === null) return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  return value;
}
