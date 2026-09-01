"use server";

import { redirect } from "next/navigation";
import { checkoutSchema } from "@pv/backend/domain/schemas";
import { placeOrder } from "@pv/backend/services/orders";
import { sendOrderPlacedEmail } from "@pv/backend/services/order-email";
import { toActionError, type ActionState } from "@/lib/action-state";
import { clearCartCookie, resolveExistingCartId } from "@/server/cart-session";
import { getCustomerPrincipal } from "@/server/customer-session";
import { grantOrderAccess } from "@/server/order-access";
import { currentRequestContext } from "@/server/session";

/**
 * A thin adapter over `placeOrder` — the same service function
 * `app/api/v1/checkout` calls, per ADR 0003.
 *
 * The **idempotency key comes from the form**, generated once when the page was
 * rendered and resubmitted unchanged on every retry. That is what makes a
 * double tap on a dropping connection produce one order rather than two, and it
 * is why the key is not generated here: a key created inside the action would be
 * different on each attempt and would deduplicate nothing.
 */
export async function placeOrderAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const idempotencyKey = formData.get("idempotencyKey");
  if (typeof idempotencyKey !== "string" || idempotencyKey.length < 8) {
    return { error: "This form has expired. Reload the page and try again." };
  }

  const parsed = checkoutSchema.safeParse({
    contactName: formData.get("contactName"),
    contactEmail: formData.get("contactEmail"),
    contactPhone: formData.get("contactPhone"),
    fulfilment: formData.get("fulfilment"),
    deliveryZoneId: formData.get("deliveryZoneId") || null,
    deliveryLga: formData.get("deliveryLga") || null,
    deliveryAddress: formData.get("deliveryAddress") || null,
    deliveryLandmark: formData.get("deliveryLandmark") || null,
    customerNote: formData.get("customerNote") || null,
    createAccount: formData.get("createAccount") === "on",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the highlighted fields." };
  }

  const cartId = await resolveExistingCartId();
  if (cartId === null) return { error: "Your cart is empty." };

  const customer = await getCustomerPrincipal();
  const context = await currentRequestContext();

  let reference: string;
  try {
    const placed = await placeOrder(
      {
        cartId,
        idempotencyKey,
        ...parsed.data,
        customerId: customer?.customerId ?? null,
      },
      { ip: context.ip },
    );
    reference = placed.reference;

    // Outside the transaction, and best-effort: an order is placed whether or
    // not Resend is reachable, and a failed send must never undo one.
    if (!placed.replayed) {
      await clearCartCookie().catch(() => {});
      void sendOrderPlacedEmail(placed.orderId).catch((error: unknown) => {
        console.error("Order confirmation email failed", {
          name: error instanceof Error ? error.name : typeof error,
        });
      });
    }
  } catch (error) {
    return toActionError(error, "Your order could not be placed. Please try again.");
  }

  // A short-lived grant for exactly this order, so the confirmation screen does
  // not ask for the phone number that was typed seconds ago. Tracking it later
  // still goes through /track and proves the number — see order-access.ts.
  await grantOrderAccess(reference);

  // `redirect` throws, so it must be outside the try — catching it would turn a
  // successful order into an error message.
  redirect(`/orders/${reference}`);
}
