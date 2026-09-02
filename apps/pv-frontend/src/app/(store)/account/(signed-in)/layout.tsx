import { redirect } from "next/navigation";
import { getCustomerPrincipal } from "@/server/customer-session";
import { AccountNav } from "../account-nav";

export const dynamic = "force-dynamic";

/**
 * The only part of the storefront that requires a customer.
 *
 * The guard is here rather than repeated in each page: a layout runs before
 * every route beneath it, so a page added to this folder later is protected by
 * existing, not by someone remembering to add a check. Nothing else in the shop
 * is gated — checkout works as a guest, tracking is authorised by reference plus
 * phone, and reviews are open to anyone.
 */
export default async function SignedInLayout({ children }: { children: React.ReactNode }) {
  const principal = await getCustomerPrincipal();
  if (principal === null) redirect("/account/sign-in?next=/account");

  return (
    <section className="section-space">
      <div className="container-shell">
        <h1 className="section-title">Your account</h1>
        <div className="mt-6">
          <AccountNav />
        </div>
        <div className="mt-8">{children}</div>
      </div>
    </section>
  );
}
