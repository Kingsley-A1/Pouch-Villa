import { createRemoteJWKSet, jwtVerify } from "jose";

/**
 * Verification of a Google ID token against Google's own published keys.
 *
 * The token now arrives from the authorization-code exchange in
 * `google-oauth.ts` rather than from a browser SDK. What this function does is
 * unchanged: it resolves a signed token to a Google subject and an email.
 *
 * This lives in `auth/` rather than inside either sign-in service because both
 * identity stacks need it and neither should import the other. That does not
 * weaken AGENTS.md §5's separation: this function resolves a token to a Google
 * subject and an email, and **nothing else**. It performs no lookup, touches no
 * table, and grants nothing. Which table that subject is then resolved against —
 * `staff` or `customer` — is decided by the caller, and the two never meet.
 *
 * Per ADR 0002: OAuth authenticates, it never authorises.
 */

let googleJwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function jwks() {
  googleJwks ??= createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));
  return googleJwks;
}

export class GoogleNotConfiguredError extends Error {
  constructor() {
    super("GOOGLE_CLIENT_ID is not configured.");
    this.name = "GoogleNotConfiguredError";
  }
}

export class GoogleIdentityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GoogleIdentityError";
  }
}

export type GoogleIdentity = {
  subject: string;
  email: string;
  emailVerified: boolean;
  fullName: string | null;
};

export async function verifyGoogleIdToken(
  idToken: string,
  /**
   * The nonce this sign-in was started with, when there is one.
   *
   * Binding the token to a value we generated is what stops a token obtained
   * for some other purpose, or replayed from an earlier sign-in, being accepted
   * here. The redirect flow always passes it; it is optional only so the
   * signature stays honest about tokens that never had one.
   */
  expectedNonce?: string,
): Promise<GoogleIdentity> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) throw new GoogleNotConfiguredError();

  const { payload } = await jwtVerify(idToken, jwks(), {
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    audience: clientId,
  });

  if (expectedNonce !== undefined && payload.nonce !== expectedNonce) {
    throw new GoogleIdentityError("That sign-in could not be matched to this browser.");
  }

  const subject = payload.sub;
  const email = typeof payload.email === "string" ? payload.email.toLowerCase() : null;
  if (!subject || !email) throw new GoogleIdentityError("Google did not return an email address.");

  return {
    subject,
    email,
    emailVerified: payload.email_verified === true,
    fullName: typeof payload.name === "string" ? payload.name : null,
  };
}
