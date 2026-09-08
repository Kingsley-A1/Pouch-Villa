import { describe, expect, it } from "vitest";
import {
  describePaymentMethod,
  describePaymentMethodForStaff,
  isCounterMethod,
  isPaymentMethod,
  isPaymentTiming,
  needsTransferInstructions,
  PAYMENT_METHODS,
  PAYMENT_TIMINGS,
} from "../src/domain/payment-method";

describe("payment methods", () => {
  it("gives every method a customer label and a staff label", () => {
    for (const method of PAYMENT_METHODS) {
      expect(describePaymentMethod(method).length).toBeGreaterThan(0);
      expect(describePaymentMethodForStaff(method).length).toBeGreaterThan(0);
    }
  });

  it("counts cash and the POS as counter methods, and a transfer as not one", () => {
    expect(isCounterMethod("cash")).toBe(true);
    expect(isCounterMethod("pos_card")).toBe(true);
    // A transfer made while standing in the shop is still a transfer: it lands in
    // the same account and still wants the reference as its narration.
    expect(isCounterMethod("bank_transfer")).toBe(false);
  });

  it("shows transfer details and the proof box for exactly one method", () => {
    const shown = PAYMENT_METHODS.filter(needsTransferInstructions);
    expect(shown).toEqual(["bank_transfer"]);
  });

  it("guards both string unions", () => {
    for (const method of PAYMENT_METHODS) expect(isPaymentMethod(method)).toBe(true);
    for (const timing of PAYMENT_TIMINGS) expect(isPaymentTiming(timing)).toBe(true);
    expect(isPaymentMethod("cheque")).toBe(false);
    expect(isPaymentTiming("later")).toBe(false);
  });
});
