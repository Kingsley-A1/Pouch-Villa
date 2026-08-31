import type { Metadata } from "next";
import { requirePermission } from "@/server/session";
import { ComingSoon } from "@/components/admin/coming-soon";

export const metadata: Metadata = { title: "Orders" };

export default async function OrdersAdminPage() {
  await requirePermission("order.view");
  return (
    <ComingSoon
      title="Orders"
      reason="Order placement is a Phase 3 item — the schema for orders and order lines does not exist yet. This page will list buyer, items, time, payment and status once checkout ships."
    />
  );
}
