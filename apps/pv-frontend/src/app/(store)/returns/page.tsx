import type { Metadata } from "next";
import { pick, readSettings } from "@pv/backend/services/settings";
import { PolicyPage } from "@/components/policy-page";

export const metadata: Metadata = { title: "Return & Warranty Policy" };

/**
 * Read from the settings store on every request, so the client can correct their
 * own wording in the admin without waiting for a deployment.
 */
export const dynamic = "force-dynamic";

export default async function Page() {
  const settings = await readSettings(["policy.returns"]);
  const policy = pick(settings, "policy.returns");

  return (
    <PolicyPage
      title="Return & Warranty Policy"
      what="return and warranty policy"
      content={policy.present ? policy.value : null}
      intro="Please read this before completing a purchase."
    />
  );
}
