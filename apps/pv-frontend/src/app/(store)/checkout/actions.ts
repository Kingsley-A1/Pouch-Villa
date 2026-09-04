"use server";

import { redirect } from "next/navigation";
import { checkoutSchema } from "@pv/backend/domain/schemas";
import { placeOrder } from "@pv/backend/services/orders";
import { sendOrderPlacedEmail } from "@pv/backend/services/order-email";
import { toActionError, type ActionState } from "@/lib/action-state";
import { clearCartCookie, resolveExistingCartId } from "@/server/cart-session";
import { establishCustomerSession, getCustomerPrincipal } from "@/server/customer-session";
import { dispatchEmail } from "@/server/notify";
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
    // No `deliveryLga`: the service takes it from the chosen area, which
    // is the only place it is known reliably.
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
  let accountCreated = false;
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
      dispatchEmail("Order confirmation", sendOrderPlacedEmail(placed.orderId));
    }

    /**
     * A buyer who ticked "create my account" is signed straight into it.
     *
     * Until now the row was created and nothing was done with it: the person had
     * an account they had never seen, no way into it without setting a password
     * they were never asked for, and no reason to believe one existed. Signing
     * them in makes the tick mean what it says.
     *
     * **Only `newCustomerId`, never a matched one.** The service hands back an
     * id here only where this checkout created the account, so an email that
     * already belonged to somebody cannot be typed into a checkout to obtain a
     * session on their order history. Best-effort, and last: a session that
     * fails to issue must not cost the buyer a placed order.
     */
    if (placed.newCustomerId !== null) {
      accountCreated = await establishCustomerSession(placed.newCustomerId).then(
        () => true,
        (error: unknown) => {
          console.error("Post-checkout sign-in failed", {
            name: error instanceof Error ? error.name : typeof error,
          });
          return false;
        },
      );
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
  //
  // Straight to the order, not to the new account. The next thing this person
  // has to do is make a bank transfer, and the account number is on that screen;
  // a profile page they did not ask for, between them and the details they need
  // to pay, would be a worse welcome than none. The account is announced there
  // instead, and the receipt upload finishes on it.
  redirect(accountCreated ? `/orders/${reference}?account=new` : `/orders/${reference}`);
}
