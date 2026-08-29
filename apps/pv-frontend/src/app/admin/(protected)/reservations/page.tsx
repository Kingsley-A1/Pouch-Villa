import { AdminHeader } from "@/components/admin-header";
import { updateReservationStatus } from "@/app/admin/(protected)/actions";
import { getReservations } from "@pv/backend/db";
import { RESERVATION_STATES } from "@pv/backend/domain/types";
export const dynamic = "force-dynamic";
export default function ReservationsPage() {
  const reservations = getReservations();
  return (
    <>
      <AdminHeader
        eyebrow="Pickup request workflow"
        title="Reservations"
        description="New → Contacted → Confirmed → Ready for pickup → Completed or Cancelled."
      />
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Reference</th>
              <th>Customer</th>
              <th>Product and device</th>
              <th>Pickup</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {reservations.map((item) => (
              <tr key={item.id}>
                <td className="font-mono font-bold">{item.reference}</td>
                <td>
                  <p className="font-bold">{item.customer_name}</p>
                  <p className="mt-1 text-xs text-zinc-500">{item.contact}</p>
                </td>
                <td>
                  <p>
                    {item.product_name || "Product removed"} · {item.variant}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">{item.phone_model}</p>
                </td>
                <td>{item.pickup_date}</td>
                <td>
                  <form action={updateReservationStatus} className="flex gap-2">
                    <input type="hidden" name="id" value={item.id} />
                    <select
                      className="field min-h-9 w-40 py-1 text-xs"
                      name="status"
                      defaultValue={item.status}
                    >
                      {RESERVATION_STATES.map((state) => (
                        <option key={state} value={state}>
                          {state.replaceAll("_", " ")}
                        </option>
                      ))}
                    </select>
                    <button className="button-ghost min-h-9 px-2 py-1 text-xs">Update</button>
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
