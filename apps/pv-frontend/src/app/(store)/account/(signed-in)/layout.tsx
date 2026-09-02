import { redirect } from "next/navigation";
import { greetingName, initials } from "@pv/backend/domain/person-name";
import { getCustomerPrincipal } from "@/server/customer-session";
import { AccountNav } from "../account-nav";
import { SignOutButton } from "../sign-out-button";

export const dynamic = "force-dynamic";

/**
 * The only part of the storefront that requires a customer.
 *
 * The guard is here rather than repeated in each page: a layout runs before
 * every route beneath it, so a page added to this folder later is protected by
 * existing, not by someone remembering to add a check. Nothing else in the shop
 * is gated — checkout works as a guest, tracking is authorised by reference plus
 * phone, and reviews are open to anyone.
 *
 * The greeting lives here rather than on the overview page so it holds on every
 * screen beneath it. "Your account" was accurate and said nothing; a name says
 * whose session this is, which is the one thing worth confirming on a phone that
 * more than one person in a household uses.
 */
export default async function SignedInLayout({ children }: { children: React.ReactNode }) {
  // The session row already carries the name and email, so greeting someone by
  // name costs nothing beyond the lookup every page in the account makes anyway.
  const principal = await getCustomerPrincipal();
  if (principal === null) redirect("/account/sign-in?next=/account");

  const name = greetingName(principal.fullName, principal.email);
  const monogram = initials(principal.fullName, principal.email);

  return (
    <section className="section-space">
      <div className="container-shell">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3.5">
            <span
              aria-hidden="true"
              className="grid h-13 w-13 shrink-0 place-items-center rounded-full bg-(--pv-red) text-lg font-extrabold text-(--pv-on-brand)"
            >
              {monogram}
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-2xl leading-tight font-extrabold sm:text-3xl">
                {name === null ? "Your account" : `Hi, ${name}`}
              </h1>
              <p className="truncate text-sm text-(--pv-muted)">{principal.email}</p>
            </div>
          </div>
          <SignOutButton />
        </div>

        <div className="mt-7">
          <AccountNav />
        </div>
        <div className="mt-8">{children}</div>
      </div>
    </section>
  );
}
