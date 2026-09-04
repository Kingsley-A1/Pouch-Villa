import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Package, Warning } from "@phosphor-icons/react/dist/ssr";
import { requireStaffPrincipal } from "@/server/session";
import { permissionsForRole } from "@pv/backend/services/roles";
import { countAllProducts } from "@pv/backend/services/catalogue";
import { countCustomers } from "@pv/backend/services/customers";
import { countCategories } from "@pv/backend/services/categories";
import { countBrands } from "@pv/backend/services/brands";
import { countStaff } from "@pv/backend/services/staff-access";
import {
  readAttentionQueues,
  readDashboardTotals,
  readLowStock,
} from "@pv/backend/services/dashboard";
import { buildDashboardCards } from "./dashboard-view-model";

export const dynamic = "force-dynamic";
/**
 * One treatment for every section heading on this screen.
 *
 * The admin was black text on white with red reserved for errors, which made a
 * shop whose whole identity is one colour look like a spreadsheet. This is the
 * restrained end of fixing that: the headings and the figures carry the brand,
 * the surfaces stay paper. A red *ground* here would be wrong — this screen is
 * read for an hour at a time, unlike the storefront, which is glanced at.
 *
 * `--pv-red` on `--pv-page` measures 4.88:1 in light and clears AA for this
 * size; it is bold, and bold text at 14px is not large text, so 4.5 is the bar
 * it has to meet rather than 3.
 */
const SECTION_HEADING =
  "flex items-center gap-2 text-sm font-bold tracking-wide text-(--pv-red) uppercase before:h-4 before:w-1 before:rounded-full before:bg-(--pv-red) before:content-['']";

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

  const [totals, queues, lowStock, products, categories, brands, activeStaff, customers] =
    await Promise.all([
      canSeeOrders ? readDashboardTotals() : null,
      readAttentionQueues(),
      granted.has("product.view") ? readLowStock() : null,
      granted.has("product.view") ? countAllProducts() : null,
      granted.has("category.manage") ? countCategories() : null,
      granted.has("category.manage") ? countBrands() : null,
      granted.has("staff.view") ? countStaff() : null,
      granted.has("customer.view") ? countCustomers() : null,
    ]);

  const attention = queues
    .filter((entry) => granted.has(entry.permission))
    .map((entry) => entry.item)
    .filter((item) => item.count > 0);

  const { sales, overview } = buildDashboardCards({
    totals,
    products,
    categories,
    brands,
    activeStaff,
    customers,
  });

  return (
    <div>
      <h1 className="text-2xl font-bold">
        Welcome, <span className="text-(--pv-red)">{principal.fullName.split(" ")[0]}</span>
      </h1>

      {/* What is waiting on a person, first. */}
      {attention.length > 0 ? (
        <section className="mt-6" aria-labelledby="needs-attention">
          <h2 id="needs-attention" className={SECTION_HEADING}>
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

      {sales.length > 0 ? (
        <section className="mt-8" aria-labelledby="sales-orders">
          <h2 id="sales-orders" className={SECTION_HEADING}>
            Sales &amp; orders
          </h2>
          <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-3">
            {sales.map((card) => (
              <Link
                key={card.label}
                href={card.href}
                className="rounded-2xl border border-(--pv-line) bg-(--pv-surface) p-4 hover:border-(--pv-red)"
              >
                <p className="text-2xl font-extrabold text-(--pv-red) tabular-nums">{card.value}</p>
                <p className="mt-1 text-sm font-semibold text-(--pv-ink)">{card.label}</p>
                {card.hint ? <p className="text-xs text-(--pv-muted)">{card.hint}</p> : null}
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {overview.length > 0 ? (
        <section className="mt-8" aria-labelledby="overview">
          <h2 id="overview" className={SECTION_HEADING}>
            Overview
          </h2>
          <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-3">
            {overview.map((card) => (
              <Link
                key={card.label}
                href={card.href}
                className="rounded-2xl border border-(--pv-line) bg-(--pv-surface) p-4 hover:border-(--pv-red)"
              >
                <p className="text-2xl font-extrabold text-(--pv-red) tabular-nums">{card.value}</p>
                <p className="mt-1 text-sm font-semibold text-(--pv-ink)">{card.label}</p>
                {card.hint ? <p className="text-xs text-(--pv-muted)">{card.hint}</p> : null}
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {lowStock !== null && lowStock.length > 0 ? (
        <section className="mt-8" aria-labelledby="low-stock">
          <h2 id="low-stock" className={SECTION_HEADING}>
            Running low
          </h2>
          <ul className="mt-3 grid gap-2">
            {lowStock.map((variant) => (
              /*
                Two lines on a phone, one from `sm`.

                This was a single row of product name, SKU and stock status, and
                the SKU was `flex-none` — so at 360 px a real SKU could not
                shrink, the name could not truncate past it, and the status was
                pushed off the card. Stacking is the fix rather than more
                truncation: a SKU cut in half is not a SKU, and this is the
                screen staff open on a phone every morning.
              */
              <li
                key={`${variant.productId}-${variant.sku}`}
                className="rounded-xl border border-(--pv-line) bg-(--pv-surface) px-4 py-2.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                  <Link
                    href={`/admin/products/${variant.productId}/edit`}
                    className="flex min-w-0 flex-1 items-center gap-2 text-sm font-semibold hover:text-(--pv-red)"
                  >
                    <Package size={16} className="flex-none" aria-hidden />
                    <span className="truncate">{variant.productName}</span>
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
                </div>
                {/*
                  The SKU on its own line, and allowed to break. It is the string
                  staff read out to check a shelf, so it is the one thing here
                  that must never be shortened.
                */}
                <p className="mt-0.5 text-xs break-all text-(--pv-muted)">{variant.sku}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {sales.length === 0 && overview.length === 0 && attention.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-dashed border-(--pv-line) p-6 text-sm text-(--pv-muted)">
          Your role does not yet have visibility into any dashboard figures.
        </p>
      ) : null}
    </div>
  );
}
