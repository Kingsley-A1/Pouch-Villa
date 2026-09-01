"use server";

import { revalidatePath } from "next/cache";
import { orderStatusChangeSchema } from "@pv/backend/domain/schemas";
import { getOrderById, transitionOrder } from "@pv/backend/services/orders";
import { sendOrderStatusEmail, sendPaymentConfirmedEmail } from "@pv/backend/services/order-email";
import { checkTransition } from "@pv/backend/domain/order-status";
import { toActionError, type ActionState } from "@/lib/action-state";
import { requirePermission } from "@/server/session";

/**
 * Advancing an order.
 *
 * Authority is re-derived server-side from the database on every call — the
 * buttons a staff member can see are never the check (§0 rule 4). The permission
 * required is whatever the **state machine** says this particular transition
 * needs, not a single blanket one: confirming a payment needs `payment.confirm`,
 * while moving an order along the fulfilment path needs `order.manage`, and an
 * Employee may hold one without the other.
 */
export async function transitionOrderAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = orderStatusChangeSchema.safeParse({
    orderId: formData.get("orderId"),
    status: formData.get("status"),
    reason: formData.get("reason") || null,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "That change is not valid." };
  }

  const order = await getOrderById(parsed.data.orderId);
  if (order === null) return { error: "That order could not be found." };

  // Ask the machine which permission this move needs, then prove it before
  // touching anything.
  const check = checkTransition(order.status, parsed.data.status, {
    fulfilment: order.fulfilment,
    actor: "staff",
  });
  if (!check.allowed) return { error: `That step is not available: ${check.reason}.` };

  const principal = await requirePermission(check.transition.permission ?? "order.manage");

  try {
    await transitionOrder(
      parsed.data.orderId,
      parsed.data.status,
      { type: "staff", id: principal.staffId },
      { reason: parsed.data.reason },
    );
  } catch (error) {
    return toActionError(error, "That order could not be updated.");
  }

  /**
   * Email is an external effect and stays outside the transaction, per the
   * warning on `withTransaction`. Best-effort: an order advances whether or not
   * Resend is reachable, and a failed send must never roll the change back.
   */
  const notify =
    parsed.data.status === "payment_confirmed"
      ? sendPaymentConfirmedEmail(parsed.data.orderId)
      : sendOrderStatusEmail(parsed.data.orderId, parsed.data.status);

  void notify.catch((error: unknown) => {
    console.error("Order status email failed", {
      name: error instanceof Error ? error.name : typeof error,
    });
  });

  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${parsed.data.orderId}`);
  return { error: null, message: "Order updated." };
}
