import { GoogleIdentityError, GoogleNotConfiguredError } from "./google";

/**
 * Google sign-in as a server-side authorization-code redirect, replacing the
 * browser SDK that used to render the button.
 *
 * ## Why the SDK went
 *
 * `accounts.google.com/gsi/client` builds its button by injecting an inline
 * `<style>` element and inline `style` attributes into our page. Neither can
 * carry our per-request nonce, and neither is addressable by a hash because the
 * values are computed at render time. Under the Content Security Policy §5
 * requires — no `unsafe-inline`, anywhere — the browser refused them, so the
 * button rendered unstyled: a 448px Google logo instead of a 320px button.
 *
 * The choice was to weaken the policy for every page in the application, or to
 * stop letting a third party write styles into our document. This is the second.
 * It also removes about 90KB of Google JavaScript from every sign-in page, and
 * lets the button be ours — so it matches the rest of the interface instead of
 * approximating it.
 *
 * ## What this module is, and is not
 *
 * Two functions: build the URL a person is sent to, and turn the code they come
 * back with into an ID token. It resolves nothing and grants nothing — the
 * caller decides whether that token means a customer, a staff member, or a role
 * code being redeemed, exactly as before. ADR 0002 stands unchanged: OAuth
 * authenticates, it never authorises.
 *
 * Framework-free, so it can be tested without a request.
 */

const AUTHORIZE_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

/** Enough to identify someone. No Gmail, no contacts, no Drive. */
const SCOPES = "openid email profile";

export type AuthorizeRequest = {
  /** Must match an Authorised redirect URI on the OAuth client, exactly. */
  redirectUri: string;
  /** Opaque value echoed back, compared against a cookie to prove origin. */
  state: string;
  /** Bound into the ID token, so a token from another flow cannot be replayed. */
  nonce: string;
};

export function googleAuthorizeUrl({ redirectUri, state, nonce }: AuthorizeRequest): string {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) throw new GoogleNotConfiguredError();

  const url = new URL(AUTHORIZE_ENDPOINT);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", SCOPES);
  url.searchParams.set("state", state);
  url.searchParams.set("nonce", nonce);
  // Always ask which account. Someone signing in on a shared phone, or adding a
  // second account, should never be silently given whichever one Google
  // remembers — and on the staff side that is the difference between two people.
  url.searchParams.set("prompt", "select_account");
  return url.toString();
}

/**
 * Exchanges the one-time code for an ID token.
 *
 * This is the only place the client *secret* is used, and it is why the exchange
 * happens on the server: the secret must never reach a browser. The access token
 * Google also returns is deliberately discarded — nothing here calls a Google
 * API on the person's behalf, so keeping it would be holding a credential with
 * no purpose.
 */
export async function exchangeCodeForIdToken(code: string, redirectUri: string): Promise<string> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new GoogleNotConfiguredError();

  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!response.ok) {
    // Google's body echoes the request and can carry the code itself. §5 forbids
    // a credential reaching a log or an error message, so only the status goes
    // anywhere a person or a log file can see.
    throw new GoogleIdentityError(`Google refused the sign-in (HTTP ${response.status}).`);
  }

  const body = (await response.json()) as { id_token?: unknown };
  if (typeof body.id_token !== "string") {
    throw new GoogleIdentityError("Google did not return an identity token.");
  }
  return body.id_token;
}

/** Whether the redirect flow can run at all. Both halves are required. */
export function isGoogleOAuthConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim());
}
