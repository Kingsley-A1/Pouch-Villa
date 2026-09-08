import { describe, expect, it, vi } from "vitest";

const readSettings = vi.fn();
const listAllDeliveryZones = vi.fn();

vi.mock("../src/services/settings", () => ({ readSettings }));
vi.mock("../src/services/delivery", () => ({ listAllDeliveryZones }));

const { readSetupChecklist } = await import("../src/services/setup-checklist");

/**
 * The checklist is what stands between a handed-over shop and a customer
 * reaching a payment page with no account to pay into. Its two failure modes
 * are equally bad: missing a real gap, and nagging about one that is closed.
 */

const ALL_KEYS = [
  "bank.account_name",
  "bank.account_number",
  "bank.bank_name",
  "store.whatsapp_number",
  "store.contact_email",
  "store.address",
  "store.opening_hours",
  "policy.about",
  "policy.returns",
  "policy.privacy",
  "policy.terms",
] as const;

/** Every key present unless named in `unset`. */
function settingsWith(unset: readonly string[]): Map<string, { present: boolean }> {
  return new Map(ALL_KEYS.map((key) => [key, { present: !unset.includes(key) }]));
}

function keysOf(tasks: { key: string }[]): string[] {
  return tasks.map((task) => task.key);
}

describe("readSetupChecklist", () => {
  it("is empty once every setting is filled and a zone exists", async () => {
    readSettings.mockResolvedValue(settingsWith([]));
    listAllDeliveryZones.mockResolvedValue([{ id: "zone-1" }]);

    expect(await readSetupChecklist()).toEqual([]);
  });

  it("names every gap when the platform is freshly handed over", async () => {
    readSettings.mockResolvedValue(settingsWith(ALL_KEYS));
    listAllDeliveryZones.mockResolvedValue([]);

    expect(keysOf(await readSetupChecklist()).sort()).toEqual([
      "bank",
      "contact",
      "delivery",
      "policies",
      "store",
    ]);
  });

  it("puts what blocks a sale above what does not", async () => {
    readSettings.mockResolvedValue(settingsWith(ALL_KEYS));
    listAllDeliveryZones.mockResolvedValue([]);

    const tasks = await readSetupChecklist();
    const lastBlocking = tasks.findLastIndex((task) => task.blocking);
    const firstOptional = tasks.findIndex((task) => !task.blocking);

    expect(lastBlocking).toBeLessThan(firstOptional);
  });

  it("still flags the bank when only the account number is missing", async () => {
    readSettings.mockResolvedValue(settingsWith(["bank.account_number"]));
    listAllDeliveryZones.mockResolvedValue([{ id: "zone-1" }]);

    expect(keysOf(await readSetupChecklist())).toEqual(["bank"]);
  });

  it("reports one row per group rather than one per unset key", async () => {
    readSettings.mockResolvedValue(
      settingsWith(["policy.about", "policy.returns", "policy.privacy", "policy.terms"]),
    );
    listAllDeliveryZones.mockResolvedValue([{ id: "zone-1" }]);

    expect(keysOf(await readSetupChecklist())).toEqual(["policies"]);
  });

  it("treats an empty delivery zone table as blocking on its own", async () => {
    readSettings.mockResolvedValue(settingsWith([]));
    listAllDeliveryZones.mockResolvedValue([]);

    const tasks = await readSetupChecklist();
    expect(keysOf(tasks)).toEqual(["delivery"]);
    expect(tasks[0]?.blocking).toBe(true);
    expect(tasks[0]?.href).toBe("/admin/delivery");
  });
});
