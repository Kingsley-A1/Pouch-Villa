import type { Metadata } from "next";
import { requirePermission } from "@/server/session";
import { listCustomers } from "@pv/backend/services/customers";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Customers" };

export default async function CustomersAdminPage() {
  await requirePermission("customer.view");
  const customers = await listCustomers();

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-bold">Customers</h1>
        <p className="mt-1 text-sm text-(--pv-muted)">
          A Pouch Villa account is created at checkout, so this list fills in once ordering ships.
        </p>
      </div>

      {customers.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-(--pv-line) p-6 text-sm text-(--pv-muted)">
          No customers yet.
        </p>
      ) : (
        <ul className="grid gap-3">
          {customers.map((customer) => (
            <li
              key={customer.id}
              className="rounded-2xl border border-(--pv-line) bg-(--pv-surface) p-4"
            >
              <p className="font-bold">{customer.fullName ?? customer.email}</p>
              <p className="text-xs text-(--pv-muted)">
                {customer.email}
                {customer.phone ? ` · ${customer.phone}` : ""} · joined{" "}
                {customer.createdAt.toLocaleDateString("en-NG")}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
