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
 * There is deliberately no `requireCustomerPrincipal` that redirects.
 *
 * Nothing a customer does is gated behind sign-in: checkout works as a guest,
 * order tracking is authorised by reference plus phone, and reviews are open.
 * The only pages that need a customer are `/profile` and its children, and those
 * redirect explicitly at the page rather than through a shared helper that would
 * make a sign-in wall the easy default.
 */
