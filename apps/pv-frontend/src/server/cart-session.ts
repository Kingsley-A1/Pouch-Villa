import { cookies } from "next/headers";
import { findCartId, generateCartToken, getOrCreateCart } from "@pv/backend/services/cart";
import { getCustomerPrincipal } from "./customer-session";

/**
 * Resolves which cart the current request belongs to.
 *
 * A signed-in customer always uses their own cart; the guest token is consulted
 * only when there is nobody signed in. That ordering is what stops a shared
 * phone attaching a stranger's guest cart to an account on sign-in.
 *
 * The guest token is opaque and only its digest reaches the database, so this
 * cookie is not a bearer credential for anything but an anonymous basket.
 */
export const CART_COOKIE = "pv_cart";

const IS_PRODUCTION = process.env.NODE_ENV === "production";
const COOKIE_NAME = IS_PRODUCTION ? `__Host-${CART_COOKIE}` : CART_COOKIE;

/** Thirty days. A cart is a convenience, and losing one is a lost sale. */
const CART_COOKIE_MAX_AGE = 30 * 24 * 60 * 60;

async function setCartCookie(token: string): Promise<void> {
  (await cookies()).set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: "lax",
    path: "/",
    maxAge: CART_COOKIE_MAX_AGE,
  });
}

export async function readCartToken(): Promise<string | null> {
  return (await cookies()).get(COOKIE_NAME)?.value ?? null;
}

/**
 * For reads. Returns null rather than creating a cart, so rendering a header
 * badge never writes to the database or sets a cookie on a page the visitor is
 * only passing through.
 */
export async function resolveExistingCartId(): Promise<string | null> {
  const customer = await getCustomerPrincipal();
  if (customer !== null) return findCartId({ customerId: customer.customerId });

  const token = await readCartToken();
  if (token === null) return null;
  return findCartId({ token });
}

/** For writes. Creates the cart, and the guest cookie, only when one is needed. */
export async function resolveOrCreateCartId(): Promise<string> {
  const customer = await getCustomerPrincipal();
  if (customer !== null) return getOrCreateCart({ customerId: customer.customerId });

  const existing = await readCartToken();
  if (existing !== null) return getOrCreateCart({ token: existing });

  const token = generateCartToken();
  await setCartCookie(token);
  return getOrCreateCart({ token });
}

export async function clearCartCookie(): Promise<void> {
  (await cookies()).delete(COOKIE_NAME);
}
