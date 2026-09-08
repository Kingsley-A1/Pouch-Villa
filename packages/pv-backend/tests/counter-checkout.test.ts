import { describe, expect, it } from "vitest";
import { checkoutSchema } from "../src/domain/schemas";
import { describeStatus } from "../src/domain/order-status";

/**
 * The rules migration 0015 could not write as a table CHECK live here and in
 * `placeOrder`. This is the half a customer can reach.
 */

function pickup(overrides: Record<string, unknown> = {}) {
  return {
    contactName: "Ada Okafor",
    contactEmail: "ada@test.invalid",
    contactPhone: "08030000000",
    fulfilment: "pickup",
    ...overrides,
  };
}

function delivery(overrides: Record<string, unknown> = {}) {
  return {
    contactName: "Ada Okafor",
    contactEmail: "ada@test.invalid",
    contactPhone: "08030000000",
    fulfilment: "delivery",
    deliveryAddress: "14 Awolowo Road",
    deliveryZoneId: "11111111-1111-4111-8111-111111111111",
    ...overrides,
  };
}

describe("checkout, paying at the counter", () => {
  it("defaults to the online transfer that was the only option before this existed", () => {
    const parsed = checkoutSchema.parse(delivery());
    expect(parsed.paymentTiming).toBe("online");
    expect(parsed.preferredPaymentMethod).toBe("bank_transfer");
    expect(parsed.preferredPickupLocal).toBeNull();
  });

  it("accepts cash on collection", () => {
    const parsed = checkoutSchema.parse(
      pickup({
        paymentTiming: "on_collection",
        preferredPaymentMethod: "cash",
        preferredPickupLocal: "2026-09-10T14:30",
      }),
    );
    expect(parsed.preferredPaymentMethod).toBe("cash");
    expect(parsed.preferredPickupLocal).toBe("2026-09-10T14:30");
  });

  it("accepts a transfer made at the counter, because that is a real thing people do", () => {
    const parsed = checkoutSchema.parse(
      pickup({ paymentTiming: "on_collection", preferredPaymentMethod: "bank_transfer" }),
    );
    expect(parsed.paymentTiming).toBe("on_collection");
  });

  it("refuses paying in the shop on a delivery order — there is no counter", () => {
    const result = checkoutSchema.safeParse(delivery({ paymentTiming: "on_collection" }));
    expect(result.success).toBe(false);
  });

  it("refuses cash on an order paid before collection", () => {
    const result = checkoutSchema.safeParse(
      pickup({ paymentTiming: "online", preferredPaymentMethod: "cash" }),
    );
    expect(result.success).toBe(false);
  });

  it("refuses a collection time on a delivery order", () => {
    const result = checkoutSchema.safeParse(delivery({ preferredPickupLocal: "2026-09-10T14:30" }));
    expect(result.success).toBe(false);
  });

  it("refuses a collection time that is not a date and time", () => {
    const result = checkoutSchema.safeParse(pickup({ preferredPickupLocal: "friday afternoon" }));
    expect(result.success).toBe(false);
  });
});

describe("what an unpaid order says", () => {
  /**
   * The sentence the client called broken. One status, because the state really
   * is the same; two sentences, because only one of them is true of each customer.
   */
  it("stops telling a counter customer to make a transfer", () => {
    expect(describeStatus("awaiting_payment", "online")).toBe("Waiting for your transfer");
    expect(describeStatus("awaiting_payment", "on_collection")).not.toMatch(/transfer/i);
    expect(describeStatus("awaiting_payment", "on_collection")).toMatch(/collect/i);
  });

  it("defaults to the online wording, so every existing caller is unchanged", () => {
    expect(describeStatus("awaiting_payment")).toBe(describeStatus("awaiting_payment", "online"));
  });

  it("says the same thing for every status the counter does not change", () => {
    for (const status of ["payment_confirmed", "preparing", "completed", "cancelled"] as const) {
      expect(describeStatus(status, "on_collection")).toBe(describeStatus(status, "online"));
    }
  });
});
