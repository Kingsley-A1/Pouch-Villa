import type { Metadata } from "next";
import { requirePermission } from "@/server/session";
import { readSettings, pick } from "@pv/backend/services/settings";
import { BankSettingsForm } from "./bank-settings-form";
import { StoreSettingsForm } from "./store-settings-form";
import { PolicySettingsForm } from "./policy-settings-form";
import { EditableSettingsSection } from "./editable-settings-section";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Settings" };

export default async function SettingsAdminPage() {
  await requirePermission("settings.view");
  const settings = await readSettings([
    "bank.account_name",
    "bank.account_number",
    "bank.bank_name",
    "store.address",
    "store.opening_hours",
    "store.whatsapp_number",
    "store.contact_email",
    "store.announcement",
    "store.instagram_url",
    "store.x_url",
    "store.locations",
    "store.hero_headline",
    "store.hero_subtitle",
    "policy.about",
    "policy.returns",
    "policy.privacy",
    "policy.terms",
  ]);

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="mt-1 text-sm text-(--pv-muted)">
          Every business fact lives here, never in source. Nothing on this page can be changed by a
          deployment.
        </p>
      </div>

      <EditableSettingsSection
        title="Bank account for transfers"
        summary="Account details shown during checkout."
      >
        <BankSettingsForm
          accountName={pick(settings, "bank.account_name")}
          accountNumber={pick(settings, "bank.account_number")}
          bankName={pick(settings, "bank.bank_name")}
        />
      </EditableSettingsSection>
      <EditableSettingsSection
        title="Store details"
        summary="Contact details, the announcement bar, and home page copy."
      >
        <StoreSettingsForm
          address={pick(settings, "store.address")}
          hours={pick(settings, "store.opening_hours")}
          whatsapp={pick(settings, "store.whatsapp_number")}
          contactEmail={pick(settings, "store.contact_email")}
          announcement={pick(settings, "store.announcement")}
          instagramUrl={pick(settings, "store.instagram_url")}
          xUrl={pick(settings, "store.x_url")}
          locations={pick(settings, "store.locations")}
          heroHeadline={pick(settings, "store.hero_headline")}
          heroSubtitle={pick(settings, "store.hero_subtitle")}
        />
      </EditableSettingsSection>
      <EditableSettingsSection
        title="Supporting pages"
        summary="About, returns, privacy, and terms content."
      >
        <PolicySettingsForm
          about={pick(settings, "policy.about")}
          returns={pick(settings, "policy.returns")}
          privacy={pick(settings, "policy.privacy")}
          terms={pick(settings, "policy.terms")}
        />
      </EditableSettingsSection>
    </div>
  );
}
