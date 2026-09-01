import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Package, Warning } from "@phosphor-icons/react/dist/ssr";
import { requireStaffPrincipal } from "@/server/session";
import { permissionsForRole } from "@pv/backend/services/roles";
import { countAllProducts } from "@pv/backend/services/catalogue";
import { countCustomers } from "@pv/backend/services/customers";
import {
  readAttentionQueues,
  readDashboardTotals,
  readLowStock,
} from "@pv/backend/services/dashboard";
import { formatKobo } from "@pv/backend/domain/money";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Dashboard" };

/**
 * The screen staff open first, every morning, usually on a phone.
 *
 * Ordered by what someone has to *do* rather than by what is easy to count: the
 * queues waiting on a person lead, the money is next, and the inventory figures
 * — which change slowly and prompt no action — come last.
 *
 * Everything is gated by the permission that makes it actionable. Showing an
 * Employee a count they cannot open is worse than showing them nothing.
 */
export default async function DashboardPage() {
  const principal = await requireStaffPrincipal();
  const granted = new Set(await permissionsForRole(principal.role));

  const canSeeOrders = granted.has("order.view");

  const [totals, queues, lowStock, products, customers] = await Promise.all([
    canSeeOrders ? readDashboardTotals() : null,
    readAttentionQueues(),
    granted.has("product.view") ? readLowStock() : null,
    granted.has("product.view") ? countAllProducts() : null,
    granted.has("customer.view") ? countCustomers() : null,
  ]);

  const attention = queues
    .filter((entry) => granted.has(entry.permission))
    .map((entry) => entry.item)
    .filter((item) => item.count > 0);

  const money = [
    totals && {
      label: "Taken today",
      value: formatKobo(totals.revenueTodayKobo),
      hint: `${totals.ordersToday} ${totals.ordersToday === 1 ? "order" : "orders"}`,
      href: "/admin/orders",
    },
    totals && {
      label: "Taken this week",
      value: formatKobo(totals.revenueThisWeekKobo),
      hint: `${totals.ordersThisWeek} ${totals.ordersThisWeek === 1 ? "order" : "orders"}`,
      href: "/admin/orders",
    },
    totals && {
      label: "Open orders",
      value: String(totals.openOrders),
      hint: "paid, not yet handed over",
      href: "/admin/orders?status=payment_confirmed",
    },
    totals && {
      label: "Awaiting payment",
      value: String(totals.awaitingPayment),
      hint: "placed, not yet paid",
      href: "/admin/orders?status=awaiting_payment",
    },
    products && {
      label: "Products",
      value: `${products.published} / ${products.total}`,
      hint: "published / total",
      href: "/admin/products",
    },
    customers !== null && {
      label: "Customers",
      value: String(customers),
      hint: null,
      href: "/admin/customers",
    },
  ].filter((card): card is Exclude<typeof card, false | null> => Boolean(card));

  return (
    <div>
      <h1 className="text-2xl font-bold">Welcome, {principal.fullName.split(" ")[0]}</h1>
      <p className="mt-1 text-sm text-(--pv-muted)">{principal.role} · Pouch Villa admin</p>

      {/* What is waiting on a person, first. */}
      {attention.length > 0 ? (
        <section className="mt-6" aria-labelledby="needs-attention">
          <h2 id="needs-attention" className="text-sm font-bold tracking-wide uppercase">
            Needs you
          </h2>
          <ul className="mt-3 grid gap-2.5 sm:grid-cols-2">
            {attention.map((item) => (
              <li key={item.key}>
                <Link
                  href={item.href}
                  className={`flex min-h-14 items-center justify-between gap-3 rounded-2xl border px-4 py-3 transition-colors ${
                    item.urgent
                      ? "border-(--pv-red) bg-[color-mix(in_srgb,var(--pv-red)_8%,var(--pv-surface))]"
                      : "border-(--pv-line) bg-(--pv-surface) hover:border-(--pv-muted)"
                  }`}
                >
                  <span className="flex items-center gap-3">
                    {item.urgent ? (
                      <Warning size={20} weight="fill" className="text-(--pv-red)" aria-hidden />
                    ) : null}
                    <span className="text-sm font-semibold">{item.label}</span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="text-xl font-extrabold tabular-nums">{item.count}</span>
                    <ArrowRight size={16} weight="bold" aria-hidden />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <p className="mt-6 rounded-2xl border border-dashed border-(--pv-line) p-5 text-sm text-(--pv-muted)">
          Nothing is waiting on you right now.
        </p>
      )}

      {money.length > 0 ? (
        <section className="mt-8" aria-labelledby="figures">
          <h2 id="figures" className="text-sm font-bold tracking-wide uppercase">
            Figures
          </h2>
          <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-3">
            {money.map((card) => (
              <Link
                key={card.label}
                href={card.href}
                className="rounded-2xl border border-(--pv-line) bg-(--pv-surface) p-4 hover:border-(--pv-red)"
              >
                <p className="text-2xl font-extrabold tabular-nums">{card.value}</p>
                <p className="mt-1 text-sm font-semibold text-(--pv-ink)">{card.label}</p>
                {card.hint ? <p className="text-xs text-(--pv-muted)">{card.hint}</p> : null}
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {lowStock !== null && lowStock.length > 0 ? (
        <section className="mt-8" aria-labelledby="low-stock">
          <h2 id="low-stock" className="text-sm font-bold tracking-wide uppercase">
            Running low
          </h2>
          <ul className="mt-3 grid gap-2">
            {lowStock.map((variant) => (
              <li
                key={`${variant.productId}-${variant.sku}`}
                className="flex items-center justify-between gap-3 rounded-xl border border-(--pv-line) bg-(--pv-surface) px-4 py-2.5"
              >
                <Link
                  href={`/admin/products/${variant.productId}/edit`}
                  className="flex min-w-0 items-center gap-2 text-sm font-semibold hover:text-(--pv-red)"
                >
                  <Package size={16} aria-hidden />
                  <span className="truncate">{variant.productName}</span>
                  <span className="flex-none text-xs text-(--pv-muted)">{variant.sku}</span>
                </Link>
                {/* Stated in words as well as colour — colour never carries
                    meaning alone (WCAG 2.2 AA). */}
                <span
                  className={`flex-none text-sm font-bold tabular-nums ${
                    variant.inStock <= 0 ? "text-(--pv-danger)" : "text-(--pv-warning)"
                  }`}
                >
                  {variant.inStock <= 0 ? "Out of stock" : `${variant.inStock} left`}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {money.length === 0 && attention.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-dashed border-(--pv-line) p-6 text-sm text-(--pv-muted)">
          Your role does not yet have visibility into any dashboard figures.
        </p>
      ) : null}
    </div>
  );
}
