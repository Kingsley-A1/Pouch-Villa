import { cookies } from "next/headers";

/**
 * The signed-out visitor's opaque token, and nothing else.
 *
 * Split from `like-session.ts` so it depends on no other adapter. Sign-in has to
 * read this cookie to carry likes into the account, and likes have to read the
 * session to know whose they are — putting both in one module would make those
 * two files import each other.
 *
 * `HttpOnly` because nothing in the browser needs to read it: the like endpoint
 * resolves the actor server-side. It is not a credential for anything beyond an
 * anonymous list of liked products.
 */
export const LIKE_COOKIE = "pv_visitor";

const IS_PRODUCTION = process.env.NODE_ENV === "production";
const COOKIE_NAME = IS_PRODUCTION ? `__Host-${LIKE_COOKIE}` : LIKE_COOKIE;

/** A year. Losing the list is not a lost sale, but it is a lost shortlist. */
const LIKE_COOKIE_MAX_AGE = 365 * 24 * 60 * 60;

export async function readVisitorToken(): Promise<string | null> {
  return (await cookies()).get(COOKIE_NAME)?.value ?? null;
}

export async function writeVisitorToken(token: string): Promise<void> {
  (await cookies()).set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: "lax",
    path: "/",
    maxAge: LIKE_COOKIE_MAX_AGE,
  });
}

/**
 * Called once a visitor's likes have been carried into their account. The rows
 * belong to the customer now, and a stale token would start a second anonymous
 * list on the next sign-out.
 */
export async function clearVisitorToken(): Promise<void> {
  (await cookies()).delete(COOKIE_NAME);
}
