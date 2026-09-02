import { cache } from "react";
import { cookies } from "next/headers";
import {
  CUSTOMER_ABSOLUTE_TTL_MS,
  CUSTOMER_SESSION_COOKIE,
  issueCustomerSession,
  revokeCustomerSession,
  verifyCustomerSession,
  type CustomerPrincipal,
} from "@pv/backend/auth/customer-session";
import { mergeGuestCart } from "@pv/backend/services/cart";
import { mergeVisitorLikes } from "@pv/backend/services/likes";
import { readCartToken } from "./cart-session";
import { clearVisitorToken, readVisitorToken } from "./visitor-cookie";

export type { CustomerPrincipal };

/**
 * The customer session cookie — a separate name, a separate table and a separate
 * code path from staff, per AGENTS.md §5. Nothing here can reach `staff`, and
 * the admin adapter in `session.ts` cannot reach `customer`.
 *
 * `__Host-` requires Secure, so it only applies once the app is served over
 * HTTPS; local development uses the plain name, matching the staff adapter.
 */
const IS_PRODUCTION = process.env.NODE_ENV === "production";
const COOKIE_NAME = IS_PRODUCTION ? `__Host-${CUSTOMER_SESSION_COOKIE}` : CUSTOMER_SESSION_COOKIE;

export async function createCustomerSession(customerId: string): Promise<void> {
  const { token, expiresAt } = await issueCustomerSession(customerId);
  (await cookies()).set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(CUSTOMER_ABSOLUTE_TTL_MS / 1000),
    expires: expiresAt,
  });
}

export async function clearCustomerSession(): Promise<void> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (token) await revokeCustomerSession(token);
  store.delete(COOKIE_NAME);
}

/** `cache()` scopes this to one request, so one lookup serves a whole tree. */
export const getCustomerPrincipal = cache(async (): Promise<CustomerPrincipal | null> => {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyCustomerSession(token);
});

/**
 * Everything that must happen when someone becomes signed in, in one place.
 *
 * Registering, signing in with a password and signing in with Google all have to
 * do the same three things, and every route and action that forgets one of them
 * is a bug a customer notices: a cart that empties, a shortlist that vanishes.
 * Keeping it here means there is one answer to "what does signing in do", rather
 * than four call sites that agree until one of them is edited.
 *
 * Both merges are best-effort. Neither is worth failing a sign-in over — being
 * unable to sign in is far worse than arriving with an empty basket — but a
 * failure is logged rather than swallowed silently.
 */
export async function establishCustomerSession(customerId: string): Promise<void> {
  const cartToken = await readCartToken();
  if (cartToken !== null) {
    await mergeGuestCart(cartToken, customerId).catch((error: unknown) => {
      console.error("Guest cart merge failed", {
        name: error instanceof Error ? error.name : typeof error,
      });
    });
  }

  const visitorToken = await readVisitorToken();
  if (visitorToken !== null) {
    await mergeVisitorLikes(visitorToken, customerId)
      .then(clearVisitorToken)
      .catch((error: unknown) => {
        console.error("Visitor like merge failed", {
          name: error instanceof Error ? error.name : typeof error,
        });
      });
  }

  // §5: the session id rotates on sign-in — a fresh session row is issued rather
  // than an existing one reused. This is last, so a merge that throws cannot
  // leave someone signed in with half their state carried over.
  await createCustomerSession(customerId);
}

/**
 * There is deliberately no `requireCustomerPrincipal` that redirects.
 *
 * Nothing a customer does is gated behind sign-in: checkout works as a guest,
 * order tracking is authorised by reference plus phone, and reviews are open.
 * The only pages that need a customer are `/profile` and its children, and those
 * redirect explicitly at the page rather than through a shared helper that would
 * make a sign-in wall the easy default.
 */
