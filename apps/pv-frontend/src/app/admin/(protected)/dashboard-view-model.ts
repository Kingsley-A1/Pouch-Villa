import { formatKobo } from "@pv/backend/domain/money";
import type { DashboardTotals } from "@pv/backend/services/dashboard";

export type DashboardCard = {
  label: string;
  value: string;
  hint: string | null;
  href: string;
};

export function buildDashboardCards(input: {
  totals: DashboardTotals | null;
  products: { published: number; total: number } | null;
  categories: number | null;
  brands: number | null;
  activeStaff: number | null;
  customers: number | null;
}): { sales: DashboardCard[]; overview: DashboardCard[] } {
  const sales: DashboardCard[] = input.totals
    ? [
        {
          label: "Taken today",
          value: formatKobo(input.totals.revenueTodayKobo),
          hint: `${input.totals.ordersToday} ${input.totals.ordersToday === 1 ? "order" : "orders"}`,
          href: "/admin/orders",
        },
        {
          label: "Taken this week",
          value: formatKobo(input.totals.revenueThisWeekKobo),
          hint: `${input.totals.ordersThisWeek} ${input.totals.ordersThisWeek === 1 ? "order" : "orders"}`,
          href: "/admin/orders",
        },
        {
          label: "Open orders",
          value: String(input.totals.openOrders),
          hint: "paid, not yet handed over",
          href: "/admin/orders?status=payment_confirmed",
        },
        {
          label: "Awaiting payment",
          value: String(input.totals.awaitingPayment),
          hint: "placed, not yet paid",
          href: "/admin/orders?status=awaiting_payment",
        },
      ]
    : [];

  const candidates: Array<DashboardCard | null> = [
    input.products
      ? {
          label: "Products",
          value: `${input.products.published} / ${input.products.total}`,
          hint: "published / total",
          href: "/admin/products",
        }
      : null,
    input.categories === null
      ? null
      : {
          label: "Categories",
          value: String(input.categories),
          hint: null,
          href: "/admin/categories",
        },
    input.brands === null
      ? null
      : { label: "Brands", value: String(input.brands), hint: null, href: "/admin/categories" },
    input.activeStaff === null
      ? null
      : {
          label: "Active staff",
          value: String(input.activeStaff),
          hint: null,
          href: "/admin/staff",
        },
    input.customers === null
      ? null
      : {
          label: "Customers",
          value: String(input.customers),
          hint: null,
          href: "/admin/customers",
        },
  ];

  return { sales, overview: candidates.filter((card): card is DashboardCard => card !== null) };
}
