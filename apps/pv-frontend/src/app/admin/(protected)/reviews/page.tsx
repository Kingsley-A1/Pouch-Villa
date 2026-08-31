import type { Metadata } from "next";
import { requirePermission } from "@/server/session";
import { ComingSoon } from "@/components/admin/coming-soon";

export const metadata: Metadata = { title: "Reviews" };

export default async function ReviewsAdminPage() {
  await requirePermission("review.moderate");
  return (
    <ComingSoon
      title="Reviews"
      reason="Reviews are held for approval before publication, per Q9 — but the review schema is a Phase 3 item alongside orders, since reviews link to an order line where one exists."
    />
  );
}
