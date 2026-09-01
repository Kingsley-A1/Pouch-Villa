import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { closePool, query } from "../src/db/client";
import { writableTestDatabaseConfigured } from "./helpers/database";
import {
  addToCart,
  generateCartToken,
  getOrCreateCart,
  mergeGuestCart,
  readCart,
  setCartLineQuantity,
} from "../src/services/cart";
import {
  CartEmptyError,
  IdempotencyConflictError,
  InsufficientStockError,
  findOrderForTracking,
  getOrderById,
  placeOrder,
  transitionOrder,
} from "../src/services/orders";
import { IllegalTransitionError } from "../src/domain/order-status";

/**
 * The commerce flow against a live CockroachDB. The retry semantics are the
 * point, per AGENTS.md §9 — a mock would assert nothing about the behaviour
 * these functions exist to get right.
 */

const describeDb = writableTestDatabaseConfigured() ? describe : describe.skip;

/** Fixture numbers and addresses. Tests are exempt from the §4 fact check. */
const CONTACT = {
  contactName: "Test Buyer",
  contactEmail: `zz-checkout-${randomUUID()}@example.test`,
  contactPhone: "08031234567",
};

const productIds: string[] = [];
const orderIds: string[] = [];
const cartIds: string[] = [];
const customerIds: string[] = [];

async function makeProduct(name: string, priceKobo: number, stock: number) {
  const slug = `zz-checkout-${randomUUID()}`;
  const productRows = await query<{ id: string }>(
    `INSERT INTO product (slug, name, summary, status, published_at)
          VALUES ($1, $2, 'A fixture product', 'published', now())
       RETURNING id`,
    [slug, name],
  );
  const productId = productRows[0]!.id;
  productIds.push(productId);

  const variantRows = await query<{ id: string }>(
    `INSERT INTO product_variant (product_id, sku, price_kobo)
          VALUES ($1, $2, $3) RETURNING id`,
    [productId, `ZZ-${randomUUID().slice(0, 8).toUpperCase()}`, priceKobo],
  );
  const variantId = variantRows[0]!.id;

  await query(
    `INSERT INTO variant_value (variant_id, axis_code, value) VALUES ($1, 'colour', $2)`,
    [variantId, "Blue"],
  );

  if (stock > 0) {
    await query(
      `INSERT INTO stock_entry (variant_id, delta, reason, note) VALUES ($1, $2, 'received', 'fixture')`,
      [variantId, stock],
    );
  }

  return { productId, variantId };
}

async function freshCart() {
  const token = generateCartToken();
  const cartId = await getOrCreateCart({ token });
  cartIds.push(cartId);
  return { token, cartId };
}

function placement(cartId: string, overrides: Record<string, unknown> = {}) {
  return {
    cartId,
    idempotencyKey: randomUUID(),
    ...CONTACT,
    fulfilment: "pickup" as const,
    createAccount: false,
    ...overrides,
  };
}

describeDb("checkout", () => {
  let cheap: { productId: string; variantId: string };
  let scarce: { productId: string; variantId: string };

  beforeAll(async () => {
    cheap = await makeProduct("ZZ Checkout Pouch", 250_000, 50);
    scarce = await makeProduct("ZZ Scarce Pouch", 100_000, 2);
  }, 180_000);

  afterAll(async () => {
    if (orderIds.length > 0) {
      await query("DELETE FROM order_event WHERE order_id = ANY($1)", [orderIds]);
      await query("DELETE FROM payment_proof WHERE order_id = ANY($1)", [orderIds]);
      await query("DELETE FROM payment WHERE order_id = ANY($1)", [orderIds]);
      await query("DELETE FROM order_line WHERE order_id = ANY($1)", [orderIds]);
      await query("DELETE FROM stock_entry WHERE order_id = ANY($1)", [orderIds]);
      await query("DELETE FROM customer_order WHERE id = ANY($1)", [orderIds]);
    }
    if (cartIds.length > 0) {
      await query("DELETE FROM cart_item WHERE cart_id = ANY($1)", [cartIds]);
      await query("DELETE FROM cart WHERE id = ANY($1)", [cartIds]);
    }
    if (customerIds.length > 0) {
      await query("DELETE FROM cart WHERE customer_id = ANY($1)", [customerIds]);
      await query("DELETE FROM customer WHERE id = ANY($1)", [customerIds]);
    }
    if (productIds.length > 0) {
      await query(
        "DELETE FROM stock_entry WHERE variant_id IN (SELECT id FROM product_variant WHERE product_id = ANY($1))",
        [productIds],
      );
      await query(
        "DELETE FROM variant_value WHERE variant_id IN (SELECT id FROM product_variant WHERE product_id = ANY($1))",
        [productIds],
      );
      await query("DELETE FROM product_variant WHERE product_id = ANY($1)", [productIds]);
      await query("DELETE FROM product WHERE id = ANY($1)", [productIds]);
    }
    await closePool();
  }, 180_000);

  describe("cart", () => {
    it("adds a line and prices it from the live variant", async () => {
      const { cartId } = await freshCart();
      await addToCart(cartId, cheap.variantId, 2);

      const cart = await readCart(cartId);
      expect(cart.lines).toHaveLength(1);
      expect(cart.lines[0]?.unitPriceKobo).toBe(250_000);
      expect(cart.lines[0]?.lineTotalKobo).toBe(500_000);
      expect(cart.lines[0]?.axes).toEqual({ colour: "Blue" });
      expect(cart.subtotalKobo).toBe(500_000);
      expect(cart.itemCount).toBe(2);
    });

    it("increases an existing line rather than duplicating it", async () => {
      const { cartId } = await freshCart();
      await addToCart(cartId, cheap.variantId, 1);
      await addToCart(cartId, cheap.variantId, 3);

      const cart = await readCart(cartId);
      expect(cart.lines).toHaveLength(1);
      expect(cart.lines[0]?.quantity).toBe(4);
    });

    it("removes a line when its quantity is set to zero", async () => {
      const { cartId } = await freshCart();
      await addToCart(cartId, cheap.variantId, 2);
      await setCartLineQuantity(cartId, cheap.variantId, 0);
      expect((await readCart(cartId)).lines).toHaveLength(0);
    });

    /**
     * Someone who added two on their phone and one on their laptop expects
     * three. Replacing rather than adding silently loses an item.
     */
    it("adds quantities when a guest cart merges into an account on sign-in", async () => {
      const customerRows = await query<{ id: string }>(
        `INSERT INTO customer (email, full_name, account_source)
              VALUES ($1, 'Merge Tester', 'self_signup') RETURNING id`,
        [`zz-merge-${randomUUID()}@example.test`],
      );
      const customerId = customerRows[0]!.id;
      customerIds.push(customerId);

      const ownCart = await getOrCreateCart({ customerId });
      cartIds.push(ownCart);
      await addToCart(ownCart, cheap.variantId, 1);

      const { token, cartId: guestCart } = await freshCart();
      await addToCart(guestCart, cheap.variantId, 2);

      const merged = await mergeGuestCart(token, customerId);
      expect(merged).toBe(ownCart);

      const cart = await readCart(merged);
      expect(cart.lines).toHaveLength(1);
      expect(cart.lines[0]?.quantity).toBe(3);

      // The guest cart is spent, not deleted.
      const guest = await query<{ converted_at: Date | null }>(
        "SELECT converted_at FROM cart WHERE id = $1",
        [guestCart],
      );
      expect(guest[0]?.converted_at).not.toBeNull();
    });
  });

  describe("placing an order", () => {
    it("snapshots price, name and variant onto the order line", async () => {
      const { cartId } = await freshCart();
      await addToCart(cartId, cheap.variantId, 2);

      const placed = await placeOrder(placement(cartId));
      orderIds.push(placed.orderId);

      expect(placed.reference).toMatch(/^PV-[2-9A-HJ-NP-Z]{5}-[2-9A-HJ-NP-Z]{5}$/);
      expect(placed.replayed).toBe(false);
      expect(placed.totalKobo).toBe(500_000);

      const order = await getOrderById(placed.orderId);
      expect(order?.status).toBe("awaiting_payment");
      expect(order?.lines).toHaveLength(1);
      expect(order?.lines[0]?.productName).toBe("ZZ Checkout Pouch");
      expect(order?.lines[0]?.unitPriceKobo).toBe(250_000);
      expect(order?.lines[0]?.axes).toEqual({ colour: "Blue" });
      // The phone is stored canonically, because tracking compares against it.
      expect(order?.contactPhone).toBe("+2348031234567");
    });

    /**
     * §6: a receipt must not change because someone edited a price. This is the
     * regression test for that promise.
     */
    it("does not change a placed order when the product's price later changes", async () => {
      const { cartId } = await freshCart();
      await addToCart(cartId, cheap.variantId, 1);
      const placed = await placeOrder(placement(cartId));
      orderIds.push(placed.orderId);

      await query("UPDATE product_variant SET price_kobo = 999999 WHERE id = $1", [
        cheap.variantId,
      ]);
      await query("UPDATE product SET name = 'ZZ Renamed After Order' WHERE id = $1", [
        cheap.productId,
      ]);

      const order = await getOrderById(placed.orderId);
      expect(order?.lines[0]?.unitPriceKobo).toBe(250_000);
      expect(order?.lines[0]?.productName).toBe("ZZ Checkout Pouch");
      expect(order?.totalKobo).toBe(250_000);

      // Restore, so later assertions in this file see the original price.
      await query("UPDATE product_variant SET price_kobo = 250000 WHERE id = $1", [
        cheap.variantId,
      ]);
      await query("UPDATE product SET name = 'ZZ Checkout Pouch' WHERE id = $1", [cheap.productId]);
    });

    /**
     * The gate condition from the work plan: a double-submitted order creates
     * exactly one order. Nigerian mobile data drops mid-request and the customer
     * taps again — this is the foreseeable loss AGENTS.md §3 names.
     */
    it("creates exactly one order when the same request is submitted twice", async () => {
      const { cartId } = await freshCart();
      await addToCart(cartId, cheap.variantId, 1);

      const request = placement(cartId);
      const first = await placeOrder(request);
      orderIds.push(first.orderId);
      const second = await placeOrder(request);

      expect(second.orderId).toBe(first.orderId);
      expect(second.reference).toBe(first.reference);
      expect(first.replayed).toBe(false);
      expect(second.replayed).toBe(true);

      const rows = await query<{ total: string }>(
        "SELECT count(*)::STRING AS total FROM customer_order WHERE id = $1",
        [first.orderId],
      );
      expect(Number(rows[0]?.total)).toBe(1);
    });

    it("creates exactly one order when both submissions race", async () => {
      const { cartId } = await freshCart();
      await addToCart(cartId, cheap.variantId, 1);

      const request = placement(cartId);
      const results = await Promise.allSettled([placeOrder(request), placeOrder(request)]);
      const fulfilled = results.filter(
        (result): result is PromiseFulfilledResult<Awaited<ReturnType<typeof placeOrder>>> =>
          result.status === "fulfilled",
      );

      const ids = new Set(fulfilled.map((result) => result.value.orderId));
      expect(ids.size).toBe(1);
      for (const id of ids) orderIds.push(id);
    });

    it("refuses a reused key that carries a different basket", async () => {
      const first = await freshCart();
      await addToCart(first.cartId, cheap.variantId, 1);
      const key = randomUUID();

      const placed = await placeOrder({ ...placement(first.cartId), idempotencyKey: key });
      orderIds.push(placed.orderId);

      const second = await freshCart();
      await addToCart(second.cartId, cheap.variantId, 1);

      await expect(
        placeOrder({ ...placement(second.cartId), idempotencyKey: key }),
      ).rejects.toThrow(IdempotencyConflictError);
    });

    it("takes the stock it sold out of the ledger", async () => {
      const { cartId } = await freshCart();
      await addToCart(cartId, cheap.variantId, 3);

      const before = await query<{ total: string }>(
        "SELECT coalesce(sum(delta), 0)::STRING AS total FROM stock_entry WHERE variant_id = $1",
        [cheap.variantId],
      );
      const placed = await placeOrder(placement(cartId));
      orderIds.push(placed.orderId);

      const after = await query<{ total: string }>(
        "SELECT coalesce(sum(delta), 0)::STRING AS total FROM stock_entry WHERE variant_id = $1",
        [cheap.variantId],
      );
      expect(Number(after[0]?.total)).toBe(Number(before[0]?.total) - 3);

      // A ledger entry, not a mutated counter.
      const entry = await query<{ reason: string; delta: string }>(
        "SELECT reason, delta::STRING AS delta FROM stock_entry WHERE order_id = $1",
        [placed.orderId],
      );
      expect(entry[0]?.reason).toBe("sold");
      expect(Number(entry[0]?.delta)).toBe(-3);
    });

    it("refuses to sell more than the ledger holds", async () => {
      const { cartId } = await freshCart();
      await addToCart(cartId, scarce.variantId, 5);
      await expect(placeOrder(placement(cartId))).rejects.toThrow(InsufficientStockError);
    });

    it("refuses an empty cart", async () => {
      const { cartId } = await freshCart();
      await expect(placeOrder(placement(cartId))).rejects.toThrow(CartEmptyError);
    });

    it("empties the cart and marks it converted", async () => {
      const { cartId } = await freshCart();
      await addToCart(cartId, cheap.variantId, 1);
      const placed = await placeOrder(placement(cartId));
      orderIds.push(placed.orderId);

      expect((await readCart(cartId)).lines).toHaveLength(0);
      const rows = await query<{ converted_at: Date | null }>(
        "SELECT converted_at FROM cart WHERE id = $1",
        [cartId],
      );
      expect(rows[0]?.converted_at).not.toBeNull();
    });

    it("records the payment it expects, so the admin has a row to reconcile", async () => {
      const { cartId } = await freshCart();
      await addToCart(cartId, cheap.variantId, 2);
      const placed = await placeOrder(placement(cartId));
      orderIds.push(placed.orderId);

      const rows = await query<{ status: string; amount_kobo: string }>(
        "SELECT status, amount_kobo::STRING AS amount_kobo FROM payment WHERE order_id = $1",
        [placed.orderId],
      );
      expect(rows[0]?.status).toBe("expected");
      expect(Number(rows[0]?.amount_kobo)).toBe(500_000);
    });

    it("creates the account when the checkbox was ticked, and not when it was not", async () => {
      const email = `zz-account-${randomUUID()}@example.test`;

      const guest = await freshCart();
      await addToCart(guest.cartId, cheap.variantId, 1);
      const guestOrder = await placeOrder(
        placement(guest.cartId, { createAccount: false, contactEmail: email }),
      );
      orderIds.push(guestOrder.orderId);
      expect((await getOrderById(guestOrder.orderId))?.customerId).toBeNull();

      const withAccount = await freshCart();
      await addToCart(withAccount.cartId, cheap.variantId, 1);
      const accountOrder = await placeOrder(
        placement(withAccount.cartId, { createAccount: true, contactEmail: email }),
      );
      orderIds.push(accountOrder.orderId);

      const order = await getOrderById(accountOrder.orderId);
      expect(order?.customerId).not.toBeNull();
      if (order?.customerId) customerIds.push(order.customerId);

      // Consent is recorded with a timestamp, which is the NDPR distinction
      // between a ticked default and a silent creation.
      const rows = await query<{ consented_at: Date | null; account_source: string }>(
        "SELECT consented_at, account_source FROM customer WHERE id = $1",
        [order?.customerId],
      );
      expect(rows[0]?.consented_at).not.toBeNull();
      expect(rows[0]?.account_source).toBe("checkout");
    });
  });

  describe("tracking", () => {
    it("authorises by reference plus the registered phone, in any format", async () => {
      const { cartId } = await freshCart();
      await addToCart(cartId, cheap.variantId, 1);
      const placed = await placeOrder(placement(cartId));
      orderIds.push(placed.orderId);

      for (const typed of ["08031234567", "+2348031234567", "0803 123 4567", "8031234567"]) {
        const found = await findOrderForTracking(placed.reference, typed);
        expect(found?.id, `${typed} should find the order`).toBe(placed.orderId);
      }
    });

    it("refuses the reference alone with the wrong phone", async () => {
      const { cartId } = await freshCart();
      await addToCart(cartId, cheap.variantId, 1);
      const placed = await placeOrder(placement(cartId));
      orderIds.push(placed.orderId);

      expect(await findOrderForTracking(placed.reference, "08090000000")).toBeNull();
      expect(await findOrderForTracking("PV-22222-33333", CONTACT.contactPhone)).toBeNull();
    });
  });

  describe("lifecycle", () => {
    let orderId = "";

    beforeEach(async () => {
      const { cartId } = await freshCart();
      await addToCart(cartId, cheap.variantId, 1);
      const placed = await placeOrder(placement(cartId, { fulfilment: "pickup" }));
      orderIds.push(placed.orderId);
      orderId = placed.orderId;
    });

    it("walks a pickup order to completion, writing the customer's timeline", async () => {
      const staff = { type: "staff" as const, id: null };
      await transitionOrder(orderId, "proof_submitted", { type: "customer", id: null });
      await transitionOrder(orderId, "payment_confirmed", staff);
      await transitionOrder(orderId, "preparing", staff);
      await transitionOrder(orderId, "ready_for_pickup", staff);
      await transitionOrder(orderId, "completed", staff);

      const order = await getOrderById(orderId);
      expect(order?.status).toBe("completed");
      expect(order?.timeline.map((entry) => entry.toStatus)).toEqual([
        "awaiting_payment",
        "proof_submitted",
        "payment_confirmed",
        "preparing",
        "ready_for_pickup",
        "completed",
      ]);
    });

    it("refuses a step the state machine does not allow", async () => {
      await expect(
        transitionOrder(orderId, "dispatched", { type: "staff", id: null }),
      ).rejects.toThrow(IllegalTransitionError);
    });

    it("refuses to dispatch a pickup order even from preparing", async () => {
      const staff = { type: "staff" as const, id: null };
      await transitionOrder(orderId, "payment_confirmed", staff);
      await transitionOrder(orderId, "preparing", staff);
      await expect(transitionOrder(orderId, "dispatched", staff)).rejects.toThrow(
        IllegalTransitionError,
      );
    });

    it("returns stock to the ledger when an order is cancelled", async () => {
      const before = await query<{ total: string }>(
        "SELECT coalesce(sum(delta), 0)::STRING AS total FROM stock_entry WHERE variant_id = $1",
        [cheap.variantId],
      );
      await transitionOrder(
        orderId,
        "cancelled",
        { type: "staff", id: null },
        { reason: "Customer changed their mind" },
      );
      const after = await query<{ total: string }>(
        "SELECT coalesce(sum(delta), 0)::STRING AS total FROM stock_entry WHERE variant_id = $1",
        [cheap.variantId],
      );

      // The goods were never sold, so the one that left comes back.
      expect(Number(after[0]?.total)).toBe(Number(before[0]?.total) + 1);
      expect((await getOrderById(orderId))?.status).toBe("cancelled");
    });

    it("writes an audit record for every privileged transition", async () => {
      await transitionOrder(orderId, "payment_confirmed", { type: "staff", id: null });
      const rows = await query<{ action: string }>(
        "SELECT action FROM audit_event WHERE entity_type = 'customer_order' AND entity_id = $1 ORDER BY occurred_at",
        [orderId],
      );
      expect(rows.map((row) => row.action)).toContain("order.placed");
      expect(rows.map((row) => row.action)).toContain("order.payment_confirmed");
    });
  });
});
