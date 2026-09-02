import { generateVisitorToken, type LikeActor } from "@pv/backend/services/likes";
import { getCustomerPrincipal } from "./customer-session";
import { readVisitorToken, writeVisitorToken } from "./visitor-cookie";

/**
 * Who is doing the liking.
 *
 * A signed-in customer always wins; the visitor cookie is consulted only when
 * nobody is signed in. That ordering matters on a shared phone — it is what
 * stops one person's likes attaching to the next person's account.
 */

/**
 * For rendering. Returns null rather than minting a token, because a Server
 * Component cannot set a cookie — and because a visitor who has never liked
 * anything should not be handed an identifier for passing through.
 */
export async function resolveExistingLikeActor(): Promise<LikeActor | null> {
  const customer = await getCustomerPrincipal();
  if (customer !== null) return { customerId: customer.customerId };

  const token = await readVisitorToken();
  return token === null ? null : { visitorToken: token };
}

/**
 * For the like endpoint, which runs in a request that may set cookies. Mints the
 * visitor token on the first like and not before.
 */
export async function resolveOrCreateLikeActor(): Promise<LikeActor> {
  const customer = await getCustomerPrincipal();
  if (customer !== null) return { customerId: customer.customerId };

  const existing = await readVisitorToken();
  if (existing !== null) return { visitorToken: existing };

  const token = generateVisitorToken();
  await writeVisitorToken(token);
  return { visitorToken: token };
}
