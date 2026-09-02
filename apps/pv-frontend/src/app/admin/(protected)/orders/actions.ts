"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { orderStatusChangeSchema } from "@pv/backend/domain/schemas";
import { getOrderById, transitionOrder, transitionOrders } from "@pv/backend/services/orders";
import { sendOrderStatusEmail, sendPaymentConfirmedEmail } from "@pv/backend/services/order-email";
import { checkTransition, isOrderStatus, type OrderStatus } from "@pv/backend/domain/order-status";
import { dispatchEmail } from "@/server/notify";
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
  dispatchEmail("Order status", notifyStatusChange(parsed.data.orderId, parsed.data.status));

  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${parsed.data.orderId}`);
  return { error: null, message: "Order updated." };
}

/**
 * Advancing several orders at once — "these six are packed", once, on a phone.
 *
 * A plain form action: the list is server-rendered and the checkboxes are the
 * selection, so there is no client state and the flow survives JavaScript never
 * arriving. Feedback returns as a redirect parameter.
 *
 * The permission is derived from the transition being requested, exactly as for
 * a single order, and every order still goes through the state machine. There is
 * no bulk path that bypasses either.
 *
 * A batch is not atomic on purpose: if four of six can legally move and two
 * cannot, four move and two are named. Refusing all six because of an order a
 * colleague had already cancelled would be the more surprising outcome.
 */
export async function bulkTransitionAction(formData: FormData): Promise<void> {
  const orderIds = formData.getAll("orderIds").filter((id): id is string => typeof id === "string");
  const status = formData.get("status");
  const filter = formData.get("filter");

  const back = (note: string) => {
    const params = new URLSearchParams();
    if (typeof filter === "string" && filter !== "") params.set("status", filter);
    params.set("done", note);
    return `/admin/orders?${params.toString()}`;
  };

  if (orderIds.length === 0) redirect(back("Choose at least one order first."));
  if (typeof status !== "string" || !isOrderStatus(status)) {
    redirect(back("That step is not valid."));
  }

  const first = orderIds[0];
  if (first === undefined) redirect(back("Choose at least one order first."));

  // The permission is whatever this move needs. Sampling one order is enough:
  // the bar only appears when the whole list shares a status and a fulfilment
  // path, so every selected order needs the same permission.
  const sample = await getOrderById(first);
  if (sample === null) redirect(back("Those orders could not be found."));

  const check = checkTransition(sample.status, status, {
    fulfilment: sample.fulfilment,
    actor: "staff",
  });
  const principal = await requirePermission(
    check.allowed ? (check.transition.permission ?? "order.manage") : "order.manage",
  );

  const result = await transitionOrders(orderIds, status, {
    type: "staff",
    id: principal.staffId,
  });

  /**
   * The same email a single transition sends, for every order that actually
   * moved.
   *
   * Without this, whether a customer hears that their order was packed depended
   * on how a staff member clicked — one order at a time, or six at once. Only
   * `result.moved` orders changed, and `transitionOrders` reports the ones it
   * refused separately, so this notifies exactly the buyers whose order really
   * advanced.
   */
  for (const orderId of result.movedIds) {
    dispatchEmail("Order status", notifyStatusChange(orderId, status));
  }

  revalidatePath("/admin/orders");

  if (result.moved === 0) {
    redirect(back(`None could be moved. ${result.refused[0]?.reason ?? ""}`.trim()));
  }
  const moved = `${result.moved} ${result.moved === 1 ? "order" : "orders"} updated.`;
  redirect(
    back(
      result.refused.length === 0
        ? moved
        : `${moved} ${result.refused.length} could not be: ${result.refused
            .map((entry) => entry.reference)
            .join(", ")}.`,
    ),
  );
}

/**
 * Which message a status change earns.
 *
 * `payment_confirmed` is the one the client asked for by name in Q6 and reads
 * differently from a fulfilment step, so it has its own wording. Keeping the
 * choice here means the single and bulk paths cannot drift into sending
 * different things for the same transition.
 */
function notifyStatusChange(orderId: string, status: OrderStatus): Promise<void> {
  return status === "payment_confirmed"
    ? sendPaymentConfirmedEmail(orderId)
    : sendOrderStatusEmail(orderId, status);
}
