// @vitest-environment node
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  redirect: (path: string) => { throw new Error(`NEXT_REDIRECT:${path}`); },
}));

const databasePath = `/tmp/pouch-villa-actions-${process.pid}.db`;

function reservationForm(model: string) {
  const form = new FormData();
  form.set("product", "blush-arc");
  form.set("model", model);
  form.set("variant", "Blush");
  form.set("name", "Prototype Tester");
  form.set("contact", "Demonstration contact");
  form.set("pickupDate", "2026-07-20");
  form.set("notes", "Automated journey test");
  form.set("demoConsent", "yes");
  return form;
}

describe("customer request journeys", () => {
  beforeAll(() => {
    process.env.DATABASE_URL = databasePath;
    process.env.DEMO_ADMIN_EMAIL = "actions@pouchvilla.demo";
    process.env.DEMO_ADMIN_PASSWORD = "ActionTestPassword!2026";
  });

  it("rejects a reservation when the selected device is not structurally compatible", async () => {
    const { createReservation } = await import("@/app/(store)/actions");
    const result = await createReservation(undefined, reservationForm("galaxy-s25-ultra"));
    expect(result).toEqual({ error: "The selected phone model is not linked as compatible with this product." });
  });

  it("creates a reservation with a reference for a linked device", async () => {
    const { createReservation } = await import("@/app/(store)/actions");
    const { one } = await import("@/lib/db");
    const before = one<{ count: number }>("SELECT COUNT(*) AS count FROM reservations")!.count;
    await expect(createReservation(undefined, reservationForm("iphone-15-pro"))).rejects.toThrow(/^NEXT_REDIRECT:\/reservation\/success\?reference=PV-R-/);
    const after = one<{ count: number }>("SELECT COUNT(*) AS count FROM reservations")!.count;
    expect(after).toBe(before + 1);
  });

  it("rejects an unknown variant instead of trusting client form values", async () => {
    const { createReservation } = await import("@/app/(store)/actions");
    const form = reservationForm("iphone-15-pro");
    form.set("variant", "Invented variant");
    const result = await createReservation(undefined, form);
    expect(result).toEqual({ error: "That product variant cannot currently be reserved." });
  });

  it("creates a case request and returns its confirmation reference", async () => {
    const { createCaseRequest } = await import("@/app/(store)/actions");
    const { one } = await import("@/lib/db");
    const form = new FormData();
    form.set("name", "Prototype Tester");
    form.set("contact", "Demonstration contact");
    form.set("brand", "Tecno");
    form.set("model", "Phantom V Fold");
    form.set("preferences", "Clear finish with enhanced protection");
    form.set("demoConsent", "yes");
    const before = one<{ count: number }>("SELECT COUNT(*) AS count FROM case_requests")!.count;
    await expect(createCaseRequest(undefined, form)).rejects.toThrow(/^NEXT_REDIRECT:\/request-case\?submitted=PV-C-/);
    const after = one<{ count: number }>("SELECT COUNT(*) AS count FROM case_requests")!.count;
    expect(after).toBe(before + 1);
  });
});
