import type { Metadata } from "next";
import { requirePermission } from "@/server/session";
import { ComingSoon } from "@/components/admin/coming-soon";

export const metadata: Metadata = { title: "Payments & Proofs" };

export default async function PaymentsAdminPage() {
  await requirePermission("payment.view");
  return (
    <ComingSoon
      title="Payments & Proofs"
      reason="Payment-proof review depends on checkout and the private R2 bucket wiring, both Phase 3 items. This page will show transfer proofs pending confirmation once that ships."
    />
  );
}
