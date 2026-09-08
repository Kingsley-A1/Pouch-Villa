import type { PermissionCode } from "../auth/permission-codes";
import { readSettings, type SettingKey } from "./settings";
import { listAllDeliveryZones } from "./delivery";

/**
 * What is still missing before the shop can trade.
 *
 * A handed-over platform starts empty by design — §0 rule 2 forbids inventing a
 * bank account or an address, so every business fact begins unset and the
 * storefront says so where one is missing. The cost of that honesty is that
 * nothing on screen tells the owner *which* facts are missing, and the first
 * discovery is a customer reaching a payment page with no account to pay into.
 *
 * This is the counterweight: the dashboard names the gaps and links straight to
 * the screen that closes each one. It disappears entirely once the shop is
 * ready, so it costs the owner nothing after the first week.
 *
 * `blocking` is reserved for the things that stop money moving. Everything else
 * is a gap worth closing, not a reason to stop.
 */
export type SetupTask = {
  key: string;
  label: string;
  /** Stated as the consequence, not the instruction — that is what makes it act on. */
  consequence: string;
  href: string;
  blocking: boolean;
  permission: PermissionCode;
};

/**
 * Grouped so one unset key does not produce four near-identical rows. An owner
 * who has set neither the account name nor the number has one job, not two.
 */
const SETTING_GROUPS: readonly {
  key: string;
  label: string;
  consequence: string;
  href: string;
  blocking: boolean;
  permission: PermissionCode;
  requires: readonly SettingKey[];
}[] = [
  {
    key: "bank",
    label: "Bank account for transfers",
    consequence: "Customers reach the payment page with no account to pay into.",
    href: "/admin/settings",
    blocking: true,
    permission: "settings.manage",
    requires: ["bank.account_name", "bank.account_number", "bank.bank_name"],
  },
  {
    key: "contact",
    label: "WhatsApp number and contact email",
    consequence: "Customers cannot reach the shop when an order goes wrong.",
    href: "/admin/settings",
    blocking: true,
    permission: "settings.manage",
    requires: ["store.whatsapp_number", "store.contact_email"],
  },
  {
    key: "store",
    label: "Shop address and opening hours",
    consequence: "Pickup customers are not told where to come or when.",
    href: "/admin/settings",
    blocking: false,
    permission: "settings.manage",
    requires: ["store.address", "store.opening_hours"],
  },
  {
    key: "policies",
    label: "About, Returns, Privacy and Terms",
    consequence: "Four pages in the footer stand empty.",
    href: "/admin/settings",
    blocking: false,
    permission: "settings.manage",
    requires: ["policy.about", "policy.returns", "policy.privacy", "policy.terms"],
  },
];

const CHECKED_KEYS: readonly SettingKey[] = SETTING_GROUPS.flatMap((group) => group.requires);

export async function readSetupChecklist(): Promise<SetupTask[]> {
  const [settings, zones] = await Promise.all([readSettings(CHECKED_KEYS), listAllDeliveryZones()]);

  const outstanding: SetupTask[] = SETTING_GROUPS.filter((group) =>
    group.requires.some((key) => !(settings.get(key)?.present ?? false)),
  ).map((group) => ({
    key: group.key,
    label: group.label,
    consequence: group.consequence,
    href: group.href,
    blocking: group.blocking,
    permission: group.permission,
  }));

  // Delivery is a row count rather than a setting: with no zone there is no fee
  // to quote, so checkout can only offer pickup.
  if (zones.length === 0) {
    outstanding.push({
      key: "delivery",
      label: "At least one delivery zone",
      consequence: "Checkout can only offer pickup — no order can be delivered.",
      href: "/admin/delivery",
      blocking: true,
      permission: "delivery.manage",
    });
  }

  // Blocking first: the owner should read the list top-down and stop when the
  // shop can trade, rather than hunting for which row is the urgent one.
  return outstanding.sort((a, b) => Number(b.blocking) - Number(a.blocking));
}
