import type { Metadata } from "next";
import { readSettings, pick } from "@pv/backend/services/settings";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { AwaitingConfirmation } from "@/components/awaiting-confirmation";
import { ContactForm } from "./contact-form";

export const metadata: Metadata = {
  title: "Contact",
  description: "Get in touch with Pouch Villa.",
};

export const dynamic = "force-dynamic";

export default async function ContactPage() {
  /**
   * Every one of these is a business fact and lives in the settings store, never
   * in source (§4). Where one is unset the page says so rather than rendering a
   * blank line where a phone number should be.
   */
  const settings = await readSettings([
    "store.address",
    "store.opening_hours",
    "store.whatsapp_number",
    "store.contact_email",
  ]);

  const details = [
    ["Address", pick(settings, "store.address"), "address"],
    ["Opening hours", pick(settings, "store.opening_hours"), "opening hours"],
    ["WhatsApp", pick(settings, "store.whatsapp_number"), "WhatsApp number"],
    ["Email", pick(settings, "store.contact_email"), "email address"],
  ] as const;

  return (
    <>
      <Breadcrumbs trail={[{ label: "Contact" }]} />
      <section className="section-space">
        <div className="container-shell grid gap-10 lg:grid-cols-2 lg:items-start">
          <div>
            <h1 className="section-title">Contact us</h1>
            <p className="mt-3 max-w-prose text-(--pv-muted)">
              Send us a message and we will get back to you. If it is about an order, include the
              reference so we can find it quickly.
            </p>
            <ContactForm />
          </div>

          <div className="card-surface p-6 lg:mt-20">
            <h2 className="text-lg font-bold">Reach us directly</h2>
            <dl className="mt-4 grid gap-4">
              {details.map(([label, setting, what]) => (
                <div key={label}>
                  <dt className="help">{label}</dt>
                  {setting.present ? (
                    <dd className="font-semibold break-words">{setting.value}</dd>
                  ) : (
                    <dd>
                      <AwaitingConfirmation what={what} />
                    </dd>
                  )}
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>
    </>
  );
}
