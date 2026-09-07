import type { Metadata } from "next";
import { requirePermission } from "@/server/session";
import { listAllDeviceLines, listAllDevices } from "@pv/backend/services/devices";
import { listAllBrands } from "@pv/backend/services/brands";
import { DeviceList } from "./device-list";
import { DeviceLineList } from "./device-line-list";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Devices" };

export default async function DevicesAdminPage() {
  await requirePermission("category.manage");
  const [devices, brands, lines] = await Promise.all([
    listAllDevices(),
    listAllBrands(),
    listAllDeviceLines(),
  ]);

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-bold">Devices</h1>
        <p className="mt-1 text-sm text-(--pv-muted)">
          The models an accessory can fit — phones, tablets, watches. This is what powers
          &ldquo;show me what fits my device&rdquo; on the storefront.
        </p>
      </div>
      <DeviceList devices={devices} brands={brands} lines={lines} />
      <DeviceLineList lines={lines} brands={brands} />
    </div>
  );
}
