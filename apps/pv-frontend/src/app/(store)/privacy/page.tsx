import type { Metadata } from "next";
import { pick, readSettings } from "@pv/backend/services/settings";
import { PolicyPage } from "@/components/policy-page";

export const metadata: Metadata = {
  title: "Privacy Policy",
  alternates: { canonical: "/privacy" },
};

/**
 * Read from the settings store on every request, so the client can correct their
 * own wording in the admin without waiting for a deployment.
 */
export const dynamic = "force-dynamic";

export default async function Page() {
  const settings = await readSettings(["policy.privacy"]);
  const policy = pick(settings, "policy.privacy");

  return (
    <PolicyPage
      title="Privacy Policy"
      what="privacy policy"
      content={policy.present ? policy.value : null}
    />
  );
}
