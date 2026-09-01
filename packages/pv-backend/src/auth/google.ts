import { createRemoteJWKSet, jwtVerify } from "jose";

/**
 * Verification of a Google Identity Services credential — an ID token JWT —
 * against Google's own published keys. No server-side redirect flow is needed
 * for the "Sign in with Google" button, which hands the browser a signed token
 * directly, and no client secret is used.
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

export async function verifyGoogleIdToken(idToken: string): Promise<GoogleIdentity> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) throw new GoogleNotConfiguredError();

  const { payload } = await jwtVerify(idToken, jwks(), {
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    audience: clientId,
  });

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
