import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

/**
 * A short-lived grant to view one order without re-entering the phone number.
 *
 * ADR 0002 authorises order tracking by **reference plus registered phone**,
 * precisely so a reference seen in a bank narration does not disclose a
 * stranger's address. That rule cannot be relaxed — but asking someone to retype
 * their phone number on the confirmation screen they were just redirected to,
 * seconds after typing it, is the kind of friction the five-minute target exists
 * to remove.
 *
 * So placement issues a signed, expiring grant naming exactly one order. It is
 * not a session, it confers nothing else, and it dies in an hour. Anyone without
 * it — including the same person tomorrow — goes through `/track` and proves the
 * phone number.
 *
 * The key is a real secret (`AUTH_SECRET`). Deriving it from a deployment id or
 * a hostname is the forgery risk §5 calls out by name.
 */

const COOKIE_NAME = "pv_order_grant";
const TTL_MS = 60 * 60 * 1000;

function signingKey(): string {
  const secret = process.env.AUTH_SECRET?.trim();
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET is not configured with at least 32 characters.");
  }
  return secret;
}

function sign(payload: string): string {
  return createHmac("sha256", signingKey()).update(payload).digest("base64url");
}

export async function grantOrderAccess(reference: string): Promise<void> {
  const expiresAt = Date.now() + TTL_MS;
  const payload = `${reference}.${expiresAt}`;
  const value = `${payload}.${sign(payload)}`;

  (await cookies()).set(COOKIE_NAME, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(TTL_MS / 1000),
  });
}

/** True only for the exact reference the grant names, and only before it expires. */
export async function hasOrderAccess(reference: string): Promise<boolean> {
  const raw = (await cookies()).get(COOKIE_NAME)?.value;
  if (raw === undefined) return false;

  const separator = raw.lastIndexOf(".");
  if (separator === -1) return false;

  const payload = raw.slice(0, separator);
  const provided = raw.slice(separator + 1);

  const expected = Buffer.from(sign(payload));
  const actual = Buffer.from(provided);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return false;

  const [grantedReference, expiresAt] = payload.split(".");
  if (grantedReference !== reference) return false;
  return Number(expiresAt) > Date.now();
}
