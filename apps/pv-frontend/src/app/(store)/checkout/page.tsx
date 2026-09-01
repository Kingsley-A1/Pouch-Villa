import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { readCart } from "@pv/backend/services/cart";
import { listActiveDeliveryZones } from "@pv/backend/services/delivery";
import { formatKobo, kobo } from "@pv/backend/domain/money";
import { generateIdempotencyKey } from "@pv/backend/domain/reference";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { resolveExistingCartId } from "@/server/cart-session";
import { getCustomerPrincipal } from "@/server/customer-session";
import { CheckoutForm } from "./checkout-form";

export const metadata: Metadata = { title: "Checkout" };
export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  const cartId = await resolveExistingCartId();
  const cart = cartId === null ? null : await readCart(cartId);

  if (cart === null || cart.lines.length === 0) redirect("/cart");

  const [zones, customer] = await Promise.all([listActiveDeliveryZones(), getCustomerPrincipal()]);

  /**
   * Every total this form can produce, formatted here on the server.
   *
   * The alternative is shipping a currency formatter and the raw kobo to the
   * browser, which would put money arithmetic on the client — the one place
   * AGENTS.md §6's branded `Kobo` type cannot protect it. The set is small and
   * bounded: the subtotal, each zone's fee, and the subtotal plus each fee.
   */
  const amounts = new Set<number>([0, cart.subtotalKobo]);
  for (const zone of zones) {
    amounts.add(zone.feeKobo);
    amounts.add(cart.subtotalKobo + zone.feeKobo);
  }
  const formatMoney = Object.fromEntries(
    [...amounts].map((amount) => [String(amount), formatKobo(kobo(amount))]),
  );

  return (
    <>
      <Breadcrumbs trail={[{ label: "Your cart", href: "/cart" }, { label: "Checkout" }]} />
      <section className="section-space">
        <div className="container-shell">
          <h1 className="section-title">Checkout</h1>

          <ul className="mt-6 grid gap-1 text-sm text-(--pv-muted)">
            {cart.lines.map((line) => (
              <li key={line.id} className="flex justify-between gap-4">
                <span className="truncate">
                  {line.productName}
                  {Object.values(line.axes).length > 0
                    ? ` · ${Object.values(line.axes).join(" · ")}`
                    : ""}{" "}
                  × {line.quantity}
                </span>
                <span className="tabular-nums">{formatKobo(line.lineTotalKobo)}</span>
              </li>
            ))}
          </ul>
          <Link href="/cart" className="mt-2 inline-block text-sm font-semibold underline">
            Edit your cart
          </Link>

          <div className="mt-8">
            <CheckoutForm
              zones={zones.map((zone) => ({
                id: zone.id,
                name: zone.lga === null ? zone.name : `${zone.name} (${zone.lga})`,
                feeKobo: zone.feeKobo,
                feeLabel: zone.feeKobo === 0 ? "Free" : formatKobo(zone.feeKobo),
                timeframe: describeTimeframe(zone.minDays, zone.maxDays),
              }))}
              idempotencyKey={generateIdempotencyKey()}
              subtotalKobo={cart.subtotalKobo}
              formatMoney={formatMoney}
              signedInEmail={customer?.email ?? null}
              signedInName={customer?.fullName ?? null}
              signedInPhone={customer?.phone ?? null}
            />
          </div>
        </div>
      </section>
    </>
  );
}

/** Absent timeframes stay absent — never an invented "2–3 days" (§0 rule 2). */
function describeTimeframe(minDays: number | null, maxDays: number | null): string | null {
  if (minDays === null && maxDays === null) return null;
  if (minDays !== null && maxDays !== null) {
    return minDays === maxDays
      ? `${minDays} ${minDays === 1 ? "day" : "days"}`
      : `${minDays}–${maxDays} days`;
  }
  const known = minDays ?? maxDays;
  return known === null ? null : `${known} ${known === 1 ? "day" : "days"}`;
}
