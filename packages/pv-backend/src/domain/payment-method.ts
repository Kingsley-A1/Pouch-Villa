/**
 * How a customer pays, and when.
 *
 * The shop trades online and over a counter, so an order has three separate
 * payment facts and this file keeps them apart:
 *
 * 1. **Timing** — before the goods are handed over, or at the counter. Only a
 *    pickup order can be paid at the counter; there is no counter on a delivery.
 * 2. **Preference** — what the customer said they would use. A statement of
 *    intent, made before they have their wallet out.
 * 3. **Settlement** — what they actually paid with, recorded by the staff member
 *    who took the money.
 *
 * Two and three are deliberately different columns. Someone who chose cash and
 * then handed over a card must produce a record that says card, and a schema
 * that overwrites the preference with the settlement loses the fact that the
 * shop was expecting cash — which is exactly what a till reconciliation needs.
 */

export const PAYMENT_METHODS = ["bank_transfer", "cash", "pos_card"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_TIMINGS = ["online", "on_collection"] as const;
export type PaymentTiming = (typeof PAYMENT_TIMINGS)[number];

export function isPaymentMethod(value: string): value is PaymentMethod {
  return (PAYMENT_METHODS as readonly string[]).includes(value);
}

export function isPaymentTiming(value: string): value is PaymentTiming {
  return (PAYMENT_TIMINGS as readonly string[]).includes(value);
}

/**
 * What a customer is shown. "POS" is what the terminal is called in every
 * Nigerian shop, and a customer who reads "card payment" will still ask the
 * cashier whether they can use the POS.
 */
const CUSTOMER_LABELS: Readonly<Record<PaymentMethod, string>> = {
  bank_transfer: "Bank transfer",
  cash: "Cash",
  pos_card: "Card on the POS",
};

/** What staff are shown. Shorter, because it sits in a table cell and a pill. */
const STAFF_LABELS: Readonly<Record<PaymentMethod, string>> = {
  bank_transfer: "Transfer",
  cash: "Cash",
  pos_card: "POS",
};

export function describePaymentMethod(method: PaymentMethod): string {
  return CUSTOMER_LABELS[method];
}

export function describePaymentMethodForStaff(method: PaymentMethod): string {
  return STAFF_LABELS[method];
}

/**
 * Whether this method is settled at the counter rather than over a bank.
 *
 * A transfer stays a transfer wherever it is made — someone standing in the shop
 * can still send one from their banking app, and it still arrives in the same
 * account and still wants the order reference as its narration. So the honest
 * test is on the method, and the timing is asked separately.
 */
export function isCounterMethod(method: PaymentMethod): boolean {
  return method === "cash" || method === "pos_card";
}

/**
 * Whether the storefront should show this order the transfer details and the
 * proof upload.
 *
 * Both are for a bank transfer, and a transfer is a transfer whether it is made
 * from the sofa or from the shop floor. A cash or POS order gets neither — a
 * page telling somebody to upload a receipt for money they have not sent is the
 * broken-looking checkout the client asked us to fix.
 */
export function needsTransferInstructions(method: PaymentMethod): boolean {
  return method === "bank_transfer";
}

/**
 * How the money is arranged, as one phrase for a document.
 *
 * An invoice is a statement of what is owed, and "what is owed" is incomplete
 * without how it is to be settled — a customer holding a printed invoice that
 * says only an amount has to remember whether they agreed to transfer or to
 * bring cash. Timing and method are two columns and one sentence here, because
 * "Cash" alone on an invoice does not say when.
 */
export function describePaymentArrangement(method: PaymentMethod, timing: PaymentTiming): string {
  const named = method === "pos_card" ? "Card (POS)" : describePaymentMethod(method);
  return timing === "on_collection" ? `${named} on collection` : named;
}
