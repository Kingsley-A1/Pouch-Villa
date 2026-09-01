"use server";

import { revalidatePath } from "next/cache";
import { addToCart, removeFromCart, setCartLineQuantity } from "@pv/backend/services/cart";
import { cartItemSchema, cartQuantitySchema } from "@pv/backend/domain/schemas";
import { toActionError, type ActionState } from "@/lib/action-state";
import { resolveExistingCartId, resolveOrCreateCartId } from "@/server/cart-session";

/**
 * Thin adapters over the same service functions `app/api/v1/cart` calls — ADR
 * 0003. There is no business logic here; if any appears, it belongs in
 * `@pv/backend/services/cart` where the API can reach it too.
 *
 * These exist alongside the endpoints rather than instead of them because a form
 * post is the only thing that works when JavaScript has not loaded yet, which on
 * a mid-range Android on Nigerian mobile data is a real fraction of visits.
 */

export async function addToCartAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = cartItemSchema.safeParse({
    variantId: formData.get("variantId"),
    quantity: formData.get("quantity") ?? 1,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Choose an option first." };
  }

  try {
    const cartId = await resolveOrCreateCartId();
    await addToCart(cartId, parsed.data.variantId, parsed.data.quantity);
  } catch (error) {
    return toActionError(error, "That could not be added to your cart.");
  }

  revalidatePath("/cart");
  revalidatePath("/", "layout");
  return { error: null, message: "Added to your cart." };
}

export async function setQuantityAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = cartQuantitySchema.safeParse({
    variantId: formData.get("variantId"),
    quantity: formData.get("quantity"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "That quantity is not valid." };
  }

  try {
    const cartId = await resolveExistingCartId();
    if (cartId === null) return { error: "Your cart is empty." };
    await setCartLineQuantity(cartId, parsed.data.variantId, parsed.data.quantity);
  } catch (error) {
    return toActionError(error, "Your cart could not be updated.");
  }

  revalidatePath("/cart");
  revalidatePath("/", "layout");
  return { error: null };
}

export async function removeLineAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const variantId = formData.get("variantId");
  if (typeof variantId !== "string") return { error: "That item could not be removed." };

  try {
    const cartId = await resolveExistingCartId();
    if (cartId === null) return { error: "Your cart is empty." };
    await removeFromCart(cartId, variantId);
  } catch (error) {
    return toActionError(error, "That item could not be removed.");
  }

  revalidatePath("/cart");
  revalidatePath("/", "layout");
  return { error: null, message: "Removed." };
}
