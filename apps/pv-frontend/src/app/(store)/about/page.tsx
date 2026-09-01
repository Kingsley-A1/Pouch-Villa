import type { Metadata } from "next";
import { pick, readSettings } from "@pv/backend/services/settings";
import { PolicyPage } from "@/components/policy-page";

export const metadata: Metadata = { title: "Pouch Villa" };

/**
 * Read from the settings store on every request, so the client can correct their
 * own wording in the admin without waiting for a deployment.
 */
export const dynamic = "force-dynamic";

export default async function Page() {
  const settings = await readSettings(["policy.about"]);
  const policy = pick(settings, "policy.about");

  return (
    <PolicyPage title="About" what="about page" content={policy.present ? policy.value : null} />
  );
}
