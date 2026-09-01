import { describe, expect, it } from "vitest";
import {
  ORDER_STATUSES,
  ORDER_TRANSITIONS,
  IllegalTransitionError,
  assertTransition,
  availableTransitions,
  checkTransition,
  describeStatus,
  isOrderStatus,
  isTerminal,
  type Fulfilment,
  type OrderStatus,
  type TransitionActor,
} from "../src/domain/order-status";

/**
 * The order equivalent of the permission matrix: for every state and every
 * target state, assert allowed *and* denied. A state machine tested only on its
 * happy path is a state machine that lets a cancelled order be dispatched.
 */

const FULFILMENTS: readonly Fulfilment[] = ["delivery", "pickup"];
const ACTORS: readonly TransitionActor[] = ["staff", "customer", "system"];

/** The intended machine, written out in full rather than derived from the table. */
const EXPECTED: Record<
  Fulfilment,
  Partial<Record<OrderStatus, Partial<Record<OrderStatus, readonly TransitionActor[]>>>>
> = {
  delivery: {
    awaiting_payment: {
      proof_submitted: ["customer", "staff"],
      payment_confirmed: ["staff"],
      cancelled: ["customer", "staff"],
    },
    proof_submitted: {
      payment_confirmed: ["staff"],
      awaiting_payment: ["staff"],
      cancelled: ["staff"],
    },
    payment_confirmed: { preparing: ["staff"], cancelled: ["staff"] },
    preparing: { dispatched: ["staff"], cancelled: ["staff"] },
    dispatched: { completed: ["staff"], cancelled: ["staff"] },
  },
  pickup: {
    awaiting_payment: {
      proof_submitted: ["customer", "staff"],
      payment_confirmed: ["staff"],
      cancelled: ["customer", "staff"],
    },
    proof_submitted: {
      payment_confirmed: ["staff"],
      awaiting_payment: ["staff"],
      cancelled: ["staff"],
    },
    payment_confirmed: { preparing: ["staff"], cancelled: ["staff"] },
    preparing: { ready_for_pickup: ["staff"], cancelled: ["staff"] },
    ready_for_pickup: { completed: ["staff"], cancelled: ["staff"] },
  },
};

describe("order state machine", () => {
  it("has exactly the eight states the client described", () => {
    expect(ORDER_STATUSES).toEqual([
      "awaiting_payment",
      "proof_submitted",
      "payment_confirmed",
      "preparing",
      "ready_for_pickup",
      "dispatched",
      "completed",
      "cancelled",
    ]);
    expect(isOrderStatus("shipped")).toBe(false);
    expect(isOrderStatus("dispatched")).toBe(true);
  });

  it("allows and denies every state × state × actor combination as intended", () => {
    for (const fulfilment of FULFILMENTS) {
      for (const from of ORDER_STATUSES) {
        for (const to of ORDER_STATUSES) {
          for (const actor of ACTORS) {
            const permittedActors = EXPECTED[fulfilment][from]?.[to] ?? [];
            const shouldAllow = permittedActors.includes(actor);
            const result = checkTransition(from, to, { fulfilment, actor });

            expect(
              result.allowed,
              `${fulfilment}: ${from} → ${to} as ${actor} should be ${
                shouldAllow ? "allowed" : "denied"
              }`,
            ).toBe(shouldAllow);
          }
        }
      }
    }
  });

  it("treats completed and cancelled as final", () => {
    expect(isTerminal("completed")).toBe(true);
    expect(isTerminal("cancelled")).toBe(true);
    expect(isTerminal("preparing")).toBe(false);

    for (const to of ORDER_STATUSES) {
      for (const fulfilment of FULFILMENTS) {
        expect(checkTransition("completed", to, { fulfilment, actor: "staff" }).allowed).toBe(
          false,
        );
        expect(checkTransition("cancelled", to, { fulfilment, actor: "staff" }).allowed).toBe(
          false,
        );
      }
    }
    expect(ORDER_TRANSITIONS.completed).toHaveLength(0);
    expect(ORDER_TRANSITIONS.cancelled).toHaveLength(0);
  });

  it("keeps the two fulfilment paths from crossing", () => {
    // A pickup order is never dispatched, and a delivery order is never
    // collected from the shop. The wrong one is refused with the reason stated.
    const pickupDispatch = checkTransition("preparing", "dispatched", {
      fulfilment: "pickup",
      actor: "staff",
    });
    expect(pickupDispatch.allowed).toBe(false);
    expect(pickupDispatch.allowed === false && pickupDispatch.reason).toContain("delivery");

    const deliveryCollect = checkTransition("preparing", "ready_for_pickup", {
      fulfilment: "delivery",
      actor: "staff",
    });
    expect(deliveryCollect.allowed).toBe(false);
    expect(deliveryCollect.allowed === false && deliveryCollect.reason).toContain("pickup");
  });

  it("lets a customer cancel only before their proof is under review", () => {
    expect(
      checkTransition("awaiting_payment", "cancelled", {
        fulfilment: "delivery",
        actor: "customer",
      }).allowed,
    ).toBe(true);

    // Once staff are reviewing a proof, the order cannot be pulled out from
    // under them.
    expect(
      checkTransition("proof_submitted", "cancelled", {
        fulfilment: "delivery",
        actor: "customer",
      }).allowed,
    ).toBe(false);
  });

  it("lets a customer submit a proof and nothing else", () => {
    const customerTransitions = ORDER_STATUSES.flatMap((from) =>
      ORDER_STATUSES.filter(
        (to) => checkTransition(from, to, { fulfilment: "delivery", actor: "customer" }).allowed,
      ).map((to) => `${from}→${to}`),
    );
    expect(customerTransitions.sort()).toEqual([
      "awaiting_payment→cancelled",
      "awaiting_payment→proof_submitted",
    ]);
  });

  it("confirms payment without a proof, because scope item 09 makes it optional", () => {
    const direct = checkTransition("awaiting_payment", "payment_confirmed", {
      fulfilment: "delivery",
      actor: "staff",
    });
    expect(direct.allowed).toBe(true);
    expect(direct.allowed === true && direct.transition.permission).toBe("payment.confirm");
  });

  it("sends a rejected proof back for another attempt rather than to a dead end", () => {
    const result = checkTransition("proof_submitted", "awaiting_payment", {
      fulfilment: "pickup",
      actor: "staff",
    });
    expect(result.allowed).toBe(true);
  });

  it("requires payment.confirm to confirm and order.manage to fulfil", () => {
    const confirm = checkTransition("proof_submitted", "payment_confirmed", {
      fulfilment: "delivery",
      actor: "staff",
    });
    expect(confirm.allowed === true && confirm.transition.permission).toBe("payment.confirm");

    const fulfil = checkTransition("payment_confirmed", "preparing", {
      fulfilment: "delivery",
      actor: "staff",
    });
    expect(fulfil.allowed === true && fulfil.transition.permission).toBe("order.manage");
  });

  it("throws a named error rather than returning false where a service asks", () => {
    expect(() =>
      assertTransition("completed", "preparing", { fulfilment: "pickup", actor: "staff" }),
    ).toThrow(IllegalTransitionError);

    try {
      assertTransition("completed", "preparing", { fulfilment: "pickup", actor: "staff" });
    } catch (error) {
      expect(error).toBeInstanceOf(IllegalTransitionError);
      expect((error as IllegalTransitionError).name).toBe("IllegalTransitionError");
      expect((error as Error).message).toContain("final state");
    }
  });

  it("offers the admin only the steps that apply to this order", () => {
    expect(availableTransitions("preparing", "pickup").map((t) => t.to)).toEqual([
      "ready_for_pickup",
      "cancelled",
    ]);
    expect(availableTransitions("preparing", "delivery").map((t) => t.to)).toEqual([
      "dispatched",
      "cancelled",
    ]);
    expect(availableTransitions("completed", "delivery")).toHaveLength(0);
  });

  it("describes every state for the customer's tracking page", () => {
    for (const status of ORDER_STATUSES) {
      expect(describeStatus(status).length).toBeGreaterThan(0);
    }
  });
});
