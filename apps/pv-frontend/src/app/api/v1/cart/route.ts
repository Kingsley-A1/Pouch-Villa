import {
  addToCart,
  readCart,
  removeFromCart,
  setCartLineQuantity,
} from "@pv/backend/services/cart";
import { cartItemSchema, cartQuantitySchema } from "@pv/backend/domain/schemas";
import { fail, ok, parseJson, toApiError } from "@/server/api";
import { resolveExistingCartId, resolveOrCreateCartId } from "@/server/cart-session";

/**
 * The cart, as an HTTP resource — ADR 0003.
 *
 * The Node runtime because this reaches the database and a session cookie, per
 * the AGENTS.md §1 runtime rule. Never static: a cart is per-visitor by
 * definition.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Reading never creates a cart, so a bare GET writes nothing and sets no cookie. */
export async function GET() {
  try {
    const cartId = await resolveExistingCartId();
    if (cartId === null) return ok({ id: null, lines: [], subtotalKobo: 0, itemCount: 0 });
    return ok(await readCart(cartId));
  } catch (error) {
    return toApiError(error);
  }
}

export async function POST(request: Request) {
  const parsed = await parseJson(request, cartItemSchema);
  if (!parsed.ok) return parsed.response;

  try {
    const cartId = await resolveOrCreateCartId();
    await addToCart(cartId, parsed.data.variantId, parsed.data.quantity);
    return ok(await readCart(cartId));
  } catch (error) {
    return toApiError(error);
  }
}

/** Setting a quantity to zero removes the line, which the schema allows. */
export async function PATCH(request: Request) {
  const parsed = await parseJson(request, cartQuantitySchema);
  if (!parsed.ok) return parsed.response;

  try {
    const cartId = await resolveExistingCartId();
    if (cartId === null) return fail("not_found", "There is no cart to update.");
    await setCartLineQuantity(cartId, parsed.data.variantId, parsed.data.quantity);
    return ok(await readCart(cartId));
  } catch (error) {
    return toApiError(error);
  }
}

export async function DELETE(request: Request) {
  const variantId = new URL(request.url).searchParams.get("variantId");
  if (variantId === null) return fail("validation_failed", "variantId is required.");

  try {
    const cartId = await resolveExistingCartId();
    if (cartId === null) return fail("not_found", "There is no cart to update.");
    await removeFromCart(cartId, variantId);
    return ok(await readCart(cartId));
  } catch (error) {
    return toApiError(error);
  }
}
