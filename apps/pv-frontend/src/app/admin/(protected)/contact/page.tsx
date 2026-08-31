import type { Metadata } from "next";
import { requirePermission } from "@/server/session";
import { ComingSoon } from "@/components/admin/coming-soon";

export const metadata: Metadata = { title: "Contact Requests" };

export default async function ContactAdminPage() {
  await requirePermission("enquiry.manage");
  return (
    <ComingSoon
      title="Contact Requests"
      reason="The public Contact Pouch Villa flow has not been built yet. This page will list and let staff handle enquiries once it ships."
    />
  );
}
