import { AdminHeader } from "@/components/admin-header";
import { addCompatibility, removeCompatibility } from "@/app/admin/(protected)/actions";
import { all, getDevices, getProducts } from "@pv/backend/db";
export const dynamic = "force-dynamic";
export default function CompatibilityPage() {
  const products = getProducts({ includeAdmin: true });
  const devices = getDevices();
  const links = all<{
    product_id: number;
    product_name: string;
    device_id: number;
    device_name: string;
    brand_name: string;
  }>(
    "SELECT p.id AS product_id,p.name AS product_name,d.id AS device_id,d.name AS device_name,b.name AS brand_name FROM product_devices pd JOIN products p ON p.id=pd.product_id JOIN devices d ON d.id=pd.device_id JOIN brands b ON b.id=d.brand_id ORDER BY b.sort_order,d.name,p.name",
  );
  return (
    <>
      <AdminHeader
        eyebrow="Structured device relationships"
        title="Compatibility manager"
        description="Brand → exact device model → linked products. These records—not product-description text—control public compatibility results."
      />
      <form
        action={addCompatibility}
        className="card-surface mb-6 grid gap-4 p-5 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
      >
        <label>
          <span className="label">Product</span>
          <select className="field" name="productId" required>
            <option value="">Choose product</option>
            {products.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="label">Brand and device model</span>
          <select className="field" name="deviceId" required>
            <option value="">Choose exact model</option>
            {devices.map((item) => (
              <option key={item.id} value={item.id}>
                {item.brand_name} {item.name}
              </option>
            ))}
          </select>
        </label>
        <button className="button-primary">Link compatibility</button>
      </form>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Brand</th>
              <th>Device model</th>
              <th>Compatible product</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {links.map((item) => (
              <tr key={`${item.product_id}-${item.device_id}`}>
                <td>{item.brand_name}</td>
                <td className="font-bold">{item.device_name}</td>
                <td>{item.product_name}</td>
                <td>
                  <form action={removeCompatibility}>
                    <input type="hidden" name="productId" value={item.product_id} />
                    <input type="hidden" name="deviceId" value={item.device_id} />
                    <button className="button-ghost min-h-9 px-2 py-1 text-xs">Remove</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
