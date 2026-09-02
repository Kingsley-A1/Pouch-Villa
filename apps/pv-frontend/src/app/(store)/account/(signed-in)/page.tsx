import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCustomerProfile } from "@pv/backend/services/customer-account";
import { listOrdersForCustomer } from "@pv/backend/services/orders";
import { listLikedProducts } from "@pv/backend/services/likes";
import { formatKobo } from "@pv/backend/domain/money";
import { describeStatus } from "@pv/backend/domain/order-status";
import { getCustomerPrincipal } from "@/server/customer-session";
import { SignOutButton } from "../sign-out-button";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your account" };

/**
 * Africa/Lagos, not the server's zone and not the browser's. A timestamp is
 * stored UTC and rendered in the shop's own timezone, so two people looking at
 * the same order see the same date (AGENTS.md §6).
 */
const DATE = new Intl.DateTimeFormat("en-NG", {
  dateStyle: "medium",
  timeZone: "Africa/Lagos",
});

export default async function AccountOverviewPage() {
  const principal = await getCustomerPrincipal();
  // The layout already redirected an unauthenticated request; this narrows the
  // type rather than re-checking the rule.
  if (principal === null) notFound();

  const [profile, orders, saved] = await Promise.all([
    getCustomerProfile(principal.customerId),
    listOrdersForCustomer(principal.customerId, 3),
    listLikedProducts(principal.customerId, 4),
  ]);
  if (profile === null) notFound();

  return (
    <div className="grid gap-8">
      <div className="card-surface p-5">
        <p className="text-sm text-(--pv-muted)">Signed in as</p>
        <p className="mt-1 text-lg font-bold break-words">{profile.fullName ?? profile.email}</p>
        {profile.fullName ? (
          <p className="text-sm break-words text-(--pv-muted)">{profile.email}</p>
        ) : null}
        <p className="mt-2 text-sm text-(--pv-muted)">
          Member since {DATE.format(profile.memberSince)}
        </p>
        <div className="mt-4">
          <SignOutButton />
        </div>
      </div>

      <section>
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-lg font-bold">Recent orders</h2>
          {orders.length > 0 ? (
            <Link href="/account/orders" className="text-sm font-bold text-(--pv-red)">
              See all
            </Link>
          ) : null}
        </div>

        {orders.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-dashed border-(--pv-line) p-6 text-sm text-(--pv-muted)">
            You have not placed an order yet.{" "}
            <Link href="/shop" className="font-bold text-(--pv-red)">
              Start shopping
            </Link>
            .
          </p>
        ) : (
          <ul className="mt-3 grid gap-3">
            {orders.map((order) => (
              <li key={order.id}>
                <Link
                  href={`/orders/${order.reference}`}
                  className="flex min-h-11 flex-wrap items-center justify-between gap-3 rounded-2xl border border-(--pv-line) p-4"
                >
                  <span>
                    <span className="font-bold">{order.reference}</span>
                    <span className="block text-sm text-(--pv-muted)">
                      {DATE.format(order.placedAt)} · {describeStatus(order.status)}
                    </span>
                  </span>
                  <span className="font-extrabold text-(--pv-red)">
                    {formatKobo(order.totalKobo)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-lg font-bold">Saved</h2>
          {saved.length > 0 ? (
            <Link href="/account/saved" className="text-sm font-bold text-(--pv-red)">
              See all
            </Link>
          ) : null}
        </div>
        {saved.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-dashed border-(--pv-line) p-6 text-sm text-(--pv-muted)">
            Tap the heart on a product to save it here.
          </p>
        ) : (
          <ul className="mt-3 grid gap-2">
            {saved.map((product) => (
              <li key={product.id}>
                <Link
                  href={`/products/${product.slug}`}
                  className="flex min-h-11 items-center rounded-xl px-1 font-semibold hover:bg-(--pv-wash)"
                >
                  {product.name}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
