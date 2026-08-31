import type { Metadata } from "next";
import { requirePermission } from "@/server/session";
import { listAllDeliveryZones } from "@pv/backend/services/delivery";
import { ZoneList } from "./zone-list";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Delivery Zones" };

export default async function DeliveryAdminPage() {
  await requirePermission("delivery.manage");
  const zones = await listAllDeliveryZones();

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-bold">Delivery Zones</h1>
        <p className="mt-1 text-sm text-(--pv-muted)">
          Fees and timeframes shown at checkout. An order in a zone that does not exist here
          resolves to a zero fee rather than a guess.
        </p>
      </div>
      <ZoneList zones={zones} />
    </div>
  );
}
