import { WarningCircle } from "@phosphor-icons/react/dist/ssr";
import { AdminHeader } from "@/components/admin-header";
import { bulkAvailability, setAvailability } from "@/app/admin/(protected)/actions";
import { all } from "@pv/backend/db";
import { availabilityTone, cn } from "@/lib/utils";
import { availabilityLabel } from "@pv/backend/domain/format";
import type { Product } from "@pv/backend/domain/types";
export const dynamic = "force-dynamic";
const states = ["available", "limited", "out_of_stock", "pre_order", "on_request", "hidden"];
export default function InventoryPage() {
  const products = all<Product & { stale: number }>(
    "SELECT *,CASE WHEN julianday('now')-julianday(availability_updated_at)>14 THEN 1 ELSE 0 END AS stale FROM products WHERE status!='archived' ORDER BY stale DESC,name",
  );
  return (
    <>
      <AdminHeader
        eyebrow="Fast stock-state control"
        title="Inventory & availability"
        description="No live quantities are stored. Staff maintains simple availability states with stale-information warnings."
      />
      <form
        id="bulk-availability"
        action={bulkAvailability}
        className="card-surface mb-6 flex flex-wrap items-end gap-3 p-5"
      >
        <label>
          <span className="label">Bulk state for checked products</span>
          <select name="availability" className="field min-w-52">
            {states.map((state) => (
              <option key={state} value={state}>
                {availabilityLabel(state)}
              </option>
            ))}
          </select>
        </label>
        <button className="button-primary">Apply bulk update</button>
      </form>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th className="w-12">Select</th>
              <th>Product</th>
              <th>Current state</th>
              <th>Last updated</th>
              <th>Quick update</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <tr key={product.id}>
                <td>
                  <input
                    form="bulk-availability"
                    type="checkbox"
                    name="productIds"
                    value={product.id}
                    aria-label={`Select ${product.name}`}
                    className="accent-[#e30613]"
                  />
                </td>
                <td className="font-bold">
                  {product.name}
                  {product.stale ? (
                    <span className="mt-1 flex items-center gap-1 text-xs font-normal text-amber-700">
                      <WarningCircle size={15} />
                      Stale information
                    </span>
                  ) : null}
                </td>
                <td>
                  <span className={cn("status-pill", availabilityTone(product.availability))}>
                    {availabilityLabel(product.availability)}
                  </span>
                </td>
                <td className="text-xs text-zinc-500">{product.availability_updated_at}</td>
                <td>
                  <InventoryQuick id={product.id} current={product.availability} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
function InventoryQuick({ id, current }: { id: number; current: string }) {
  return (
    <form action={setAvailability} className="flex gap-2">
      <input type="hidden" name="id" value={id} />
      <select
        name="availability"
        defaultValue={current}
        className="field min-h-9 w-40 py-1 text-xs"
      >
        {states.map((state) => (
          <option key={state} value={state}>
            {availabilityLabel(state)}
          </option>
        ))}
      </select>
      <button className="button-ghost min-h-9 px-2 py-1 text-xs">Save</button>
    </form>
  );
}
