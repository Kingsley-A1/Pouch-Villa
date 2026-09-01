import type { PermissionCode } from "../auth/permission-codes";

/**
 * The order lifecycle, as a single typed transition table.
 *
 * The states and the branch are the client's own, transcribed from their Q6
 * answer in docs/decisions/0005-order-lifecycle-and-reviews.md. Keeping the
 * whole machine in one constant is the point: a state machine spread across the
 * services that use it gets a ninth state added in one place and forgotten in
 * three, and the bug shows up as an order nobody can advance.
 *
 * Every rule about who may move an order, and when, is expressed here. A service
 * calls `assertTransition` and never reasons about status itself.
 */

export const ORDER_STATUSES = [
  "awaiting_payment",
  "proof_submitted",
  "payment_confirmed",
  "preparing",
  "ready_for_pickup",
  "dispatched",
  "completed",
  "cancelled",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const TERMINAL_STATUSES: readonly OrderStatus[] = ["completed", "cancelled"];

export type Fulfilment = "delivery" | "pickup";

export type TransitionActor = "staff" | "customer" | "system";

export type OrderTransition = {
  to: OrderStatus;
  /** Who may perform it. A customer may perform exactly one transition. */
  actors: readonly TransitionActor[];
  /** Present where the transition belongs to only one fulfilment path. */
  fulfilment?: Fulfilment;
  /** Required of a staff actor. Absent means no permission beyond being staff. */
  permission?: PermissionCode;
  /** Shown to the customer on the tracking timeline. */
  label: string;
};

/**
 * Cancellation is reachable from every non-terminal state, but it is written out
 * per state rather than special-cased in the checking function, so that reading
 * this table tells you the whole truth about a state without also having to read
 * the code below it.
 *
 * Note which cancellations a customer may perform: only from `awaiting_payment`.
 * Once a proof is under review, an order cannot be pulled out from under the
 * staff member reviewing it.
 */
const cancelByStaff = (fulfilment?: Fulfilment): OrderTransition => ({
  to: "cancelled",
  actors: ["staff"],
  ...(fulfilment === undefined ? {} : { fulfilment }),
  permission: "order.manage",
  label: "Order cancelled",
});

export const ORDER_TRANSITIONS: Readonly<Record<OrderStatus, readonly OrderTransition[]>> = {
  awaiting_payment: [
    {
      to: "proof_submitted",
      actors: ["customer", "staff"],
      label: "Payment proof received",
    },
    // Scope item 09 makes the proof optional, so a staff member who can see the
    // transfer on the bank statement confirms it directly. The proof is a
    // convenience; the statement is the evidence.
    {
      to: "payment_confirmed",
      actors: ["staff"],
      permission: "payment.confirm",
      label: "Payment confirmed",
    },
    { to: "cancelled", actors: ["customer", "staff"], label: "Order cancelled" },
  ],

  proof_submitted: [
    {
      to: "payment_confirmed",
      actors: ["staff"],
      permission: "payment.confirm",
      label: "Payment confirmed",
    },
    // A rejected proof returns the order to where it was, so the customer can
    // upload a better photo rather than starting again.
    {
      to: "awaiting_payment",
      actors: ["staff"],
      permission: "payment.confirm",
      label: "Payment proof could not be accepted",
    },
    cancelByStaff(),
  ],

  payment_confirmed: [
    {
      to: "preparing",
      actors: ["staff"],
      permission: "order.manage",
      label: "Preparing your order",
    },
    cancelByStaff(),
  ],

  preparing: [
    {
      to: "ready_for_pickup",
      actors: ["staff"],
      fulfilment: "pickup",
      permission: "order.manage",
      label: "Ready for pickup",
    },
    {
      to: "dispatched",
      actors: ["staff"],
      fulfilment: "delivery",
      permission: "order.manage",
      label: "Out for delivery",
    },
    cancelByStaff(),
  ],

  /**
   * These two states belong to one fulfilment path each, so their *exits* are
   * gated too — not only the transitions into them. A delivery order has no
   * business being in `ready_for_pickup`, and if data repair or an import ever
   * puts one there, the machine should refuse to move it rather than quietly
   * complete an order that was never collected.
   */
  ready_for_pickup: [
    {
      to: "completed",
      actors: ["staff"],
      fulfilment: "pickup",
      permission: "order.manage",
      label: "Collected",
    },
    cancelByStaff("pickup"),
  ],

  dispatched: [
    {
      to: "completed",
      actors: ["staff"],
      fulfilment: "delivery",
      permission: "order.manage",
      label: "Delivered",
    },
    cancelByStaff("delivery"),
  ],

  completed: [],
  cancelled: [],
};

export function isOrderStatus(value: string): value is OrderStatus {
  return (ORDER_STATUSES as readonly string[]).includes(value);
}

export function isTerminal(status: OrderStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

export class IllegalTransitionError extends Error {
  constructor(
    readonly from: OrderStatus,
    readonly to: OrderStatus,
    reason: string,
  ) {
    super(`An order cannot go from ${from} to ${to}: ${reason}.`);
    this.name = "IllegalTransitionError";
  }
}

export type TransitionContext = {
  fulfilment: Fulfilment;
  actor: TransitionActor;
};

export type TransitionCheck =
  { allowed: true; transition: OrderTransition } | { allowed: false; reason: string };

export function checkTransition(
  from: OrderStatus,
  to: OrderStatus,
  context: TransitionContext,
): TransitionCheck {
  if (isTerminal(from)) {
    return { allowed: false, reason: `${from} is a final state` };
  }

  const candidates = ORDER_TRANSITIONS[from].filter((transition) => transition.to === to);
  if (candidates.length === 0) {
    return { allowed: false, reason: "that is not a step this order can take" };
  }

  const forThisPath = candidates.filter(
    (transition) =>
      transition.fulfilment === undefined || transition.fulfilment === context.fulfilment,
  );
  if (forThisPath.length === 0) {
    return {
      allowed: false,
      reason: `that step only applies to a ${candidates[0]?.fulfilment} order`,
    };
  }

  const permitted = forThisPath.find((transition) => transition.actors.includes(context.actor));
  if (permitted === undefined) {
    return { allowed: false, reason: `a ${context.actor} may not make that change` };
  }

  return { allowed: true, transition: permitted };
}

/** The form services use: it either returns the transition or refuses loudly. */
export function assertTransition(
  from: OrderStatus,
  to: OrderStatus,
  context: TransitionContext,
): OrderTransition {
  const result = checkTransition(from, to, context);
  if (!result.allowed) throw new IllegalTransitionError(from, to, result.reason);
  return result.transition;
}

/** What the admin may offer for an order in this state, on this fulfilment path. */
export function availableTransitions(
  from: OrderStatus,
  fulfilment: Fulfilment,
): readonly OrderTransition[] {
  return ORDER_TRANSITIONS[from].filter(
    (transition) =>
      transition.actors.includes("staff") &&
      (transition.fulfilment === undefined || transition.fulfilment === fulfilment),
  );
}

/**
 * Wording for the customer's tracking page. Deliberately separate from the
 * transition labels: this describes where an order *is*, not what just happened
 * to it, and the two read differently on a page a worried customer is refreshing.
 */
const STATUS_DESCRIPTIONS: Readonly<Record<OrderStatus, string>> = {
  awaiting_payment: "Waiting for your transfer",
  proof_submitted: "We are checking your payment",
  payment_confirmed: "Payment received",
  preparing: "We are preparing your order",
  ready_for_pickup: "Ready for you to collect",
  dispatched: "On its way to you",
  completed: "Completed",
  cancelled: "Cancelled",
};

export function describeStatus(status: OrderStatus): string {
  return STATUS_DESCRIPTIONS[status];
}
