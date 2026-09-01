import { cache } from "react";
import { countCartItems } from "@pv/backend/services/cart";
import { getCustomerPrincipal } from "./customer-session";
import { readCartToken } from "./cart-session";

/**
 * The cart count for the header badge.
 *
 * `cache()` scopes it to one request, so a layout and a page asking for it
 * share a single query. A visitor with no cart cookie and no session costs no
 * query at all — most first visits fall into that case, and the store header
 * renders on every page.
 */
export const getCartCount = cache(async (): Promise<number> => {
  const customer = await getCustomerPrincipal();
  if (customer !== null) return countCartItems({ customerId: customer.customerId });

  const token = await readCartToken();
  if (token === null) return 0;
  return countCartItems({ token });
});
