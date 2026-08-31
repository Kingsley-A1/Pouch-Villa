import type { Metadata } from "next";
import Link from "next/link";
import { requireStaffPrincipal } from "@/server/session";
import { permissionsForRole } from "@pv/backend/services/roles";
import { countAllProducts } from "@pv/backend/services/catalogue";
import { countCategories } from "@pv/backend/services/categories";
import { countBrands } from "@pv/backend/services/brands";
import { countStaff } from "@pv/backend/services/staff-access";
import { countCustomers } from "@pv/backend/services/customers";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Dashboard" };

async function statFor<T>(permission: string, granted: Set<string>, load: () => Promise<T>) {
  return granted.has(permission) ? load() : null;
}

export default async function DashboardPage() {
  const principal = await requireStaffPrincipal();
  const granted = new Set(await permissionsForRole(principal.role));

  const [products, categories, brands, staff, customers] = await Promise.all([
    statFor("product.view", granted, countAllProducts),
    statFor("category.manage", granted, countCategories),
    statFor("category.manage", granted, countBrands),
    statFor("staff.view", granted, countStaff),
    statFor("customer.view", granted, countCustomers),
  ]);

  const cards = [
    products && {
      label: "Products",
      value: `${products.published} / ${products.total}`,
      hint: "published / total",
      href: "/admin/products",
    },
    categories !== null && {
      label: "Categories",
      value: String(categories),
      href: "/admin/categories",
    },
    brands !== null && { label: "Brands", value: String(brands), href: "/admin/categories" },
    staff !== null && { label: "Active staff", value: String(staff), href: "/admin/staff" },
    customers !== null && {
      label: "Customers",
      value: String(customers),
      href: "/admin/customers",
    },
  ].filter((card): card is Exclude<typeof card, false | null> => Boolean(card));

  return (
    <div>
      <h1 className="text-2xl font-bold">Welcome, {principal.fullName.split(" ")[0]}</h1>
      <p className="mt-1 text-sm text-(--pv-muted)">{principal.role} · Pouch Villa admin</p>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {cards.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className="rounded-2xl border border-(--pv-line) bg-white p-4 hover:border-(--pv-red)"
          >
            <p className="text-2xl font-extrabold tabular-nums">{card.value}</p>
            <p className="mt-1 text-sm font-semibold text-(--pv-ink)">{card.label}</p>
            {"hint" in card && card.hint ? (
              <p className="text-xs text-(--pv-muted)">{card.hint}</p>
            ) : null}
          </Link>
        ))}
      </div>

      {cards.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-dashed border-(--pv-line) p-6 text-sm text-(--pv-muted)">
          Your role does not yet have visibility into any dashboard figures.
        </p>
      ) : null}
    </div>
  );
}
