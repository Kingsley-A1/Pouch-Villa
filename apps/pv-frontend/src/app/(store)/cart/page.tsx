import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ShoppingBag } from "@phosphor-icons/react/dist/ssr";
import { readCart } from "@pv/backend/services/cart";
import { formatKobo, kobo } from "@pv/backend/domain/money";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { resolveExistingCartId } from "@/server/cart-session";
import { QuantityStepper } from "./quantity-stepper";

export const metadata: Metadata = { title: "Your cart" };

/**
 * A cart is per-visitor, so this can never be prerendered or cached.
 */
export const dynamic = "force-dynamic";

export default async function CartPage() {
  const cartId = await resolveExistingCartId();
  const cart = cartId === null ? null : await readCart(cartId);
  const lines = cart?.lines ?? [];

  /**
   * A line whose stock has fallen below what is in the cart blocks checkout,
   * and says so on the line itself rather than failing at the last step. Finding
   * out at the payment screen is the worst possible moment.
   */
  const unavailable = lines.filter((line) => line.inStock < line.quantity);
  const canCheckout = lines.length > 0 && unavailable.length === 0;

  return (
    <>
      <Breadcrumbs trail={[{ label: "Your cart" }]} />
      <section className="section-space">
        <div className="container-shell">
          <h1 className="section-title">Your cart</h1>

          {lines.length === 0 ? (
            <div className="card-surface mt-8 grid place-items-center gap-4 px-6 py-16 text-center">
              <ShoppingBag size={40} className="text-(--pv-muted)" aria-hidden="true" />
              <p className="text-(--pv-muted)">There is nothing in your cart yet.</p>
              <Link href="/shop" className="button-primary">
                Start shopping
              </Link>
            </div>
          ) : (
            <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_22rem] lg:items-start">
              <ul className="grid gap-4">
                {lines.map((line) => (
                  <li key={line.id} className="card-surface flex gap-4 p-4">
                    <div className="relative h-24 w-24 flex-none overflow-hidden rounded-xl bg-(--pv-wash)">
                      {line.imageUrl ? (
                        <Image
                          src={line.imageUrl}
                          alt=""
                          fill
                          sizes="96px"
                          className="object-cover"
                        />
                      ) : null}
                    </div>

                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/products/${line.productSlug}`}
                        className="font-bold hover:text-(--pv-red)"
                      >
                        {line.productName}
                      </Link>
                      {Object.values(line.axes).length > 0 ? (
                        <p className="mt-0.5 text-sm text-(--pv-muted)">
                          {Object.values(line.axes).join(" · ")}
                        </p>
                      ) : null}
                      <p className="mt-1 text-sm text-(--pv-muted) tabular-nums">
                        {formatKobo(line.unitPriceKobo)} each
                      </p>

                      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
                        <QuantityStepper
                          variantId={line.variantId}
                          quantity={line.quantity}
                          inStock={line.inStock}
                          productName={line.productName}
                        />
                        <p className="font-extrabold tabular-nums">
                          {formatKobo(line.lineTotalKobo)}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>

              <aside className="card-surface p-5 lg:sticky lg:top-24">
                <h2 className="text-lg font-bold">Summary</h2>
                <dl className="mt-4 grid gap-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-(--pv-muted)">Subtotal</dt>
                    <dd className="font-semibold tabular-nums">
                      {formatKobo(cart?.subtotalKobo ?? kobo(0))}
                    </dd>
                  </div>
                  {/*
                    Delivery is deliberately not estimated here. The fee comes
                    from the admin's zone table and depends on where the order is
                    going, which is not known until checkout — a guessed figure
                    that later changes is worse than an honest "next step".
                  */}
                  <div className="flex justify-between">
                    <dt className="text-(--pv-muted)">Delivery</dt>
                    <dd className="text-(--pv-muted)">Calculated at checkout</dd>
                  </div>
                </dl>

                {unavailable.length > 0 ? (
                  <p className="mt-4 rounded-xl bg-(--pv-wash) p-3 text-sm" role="alert">
                    Some items are no longer available in the quantity you chose. Adjust them to
                    continue.
                  </p>
                ) : null}

                {canCheckout ? (
                  <Link href="/checkout" className="button-primary mt-5 w-full">
                    Checkout <ArrowRight size={18} weight="bold" />
                  </Link>
                ) : (
                  <button type="button" className="button-primary mt-5 w-full" disabled>
                    Checkout
                  </button>
                )}

                <Link href="/shop" className="button-ghost mt-2.5 w-full">
                  Keep shopping
                </Link>
              </aside>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
