import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle } from "@phosphor-icons/react/dist/ssr";
import { greetingName } from "@pv/backend/domain/person-name";
import { getCustomerPrincipal } from "@/server/customer-session";
import { toSingle } from "@/lib/utils";
import { ContinueToAccount } from "./continue-to-account";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Welcome to Pouch Villa",
  robots: { index: false, follow: false },
};

/**
 * The one screen that says "that worked".
 *
 * Registering used to land straight on the account overview, which looks
 * identical whether you just joined or signed in last week. On a phone, on a
 * connection that made the form take a few seconds, the honest reading of that
 * is "nothing happened" — and the next thing someone does is fill the form in
 * again. This page exists to close that loop before moving them on.
 *
 * It is reached only with a session in hand, so it cannot be used to imply an
 * account exists when it does not.
 */
export default async function WelcomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const principal = await getCustomerPrincipal();
  if (principal === null) redirect("/account/sign-in?next=/account");

  const params = await searchParams;
  const requested = toSingle(params.next);
  // The action already narrowed this to a path on this site before redirecting
  // here; re-checking is cheap and keeps the guarantee local to the page that
  // renders the link, rather than resting on a caller staying correct.
  const next =
    requested.startsWith("/") && !requested.startsWith("//") && !requested.startsWith("/\\")
      ? requested
      : "/account";

  const name = greetingName(principal.fullName, principal.email);
  const continuing = next === "/account" ? "your account" : "where you left off";

  return (
    <section className="section-space">
      <div className="container-shell max-w-lg">
        <div className="card-surface rise-in p-6 text-center sm:p-9">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[color-mix(in_srgb,var(--pv-success)_14%,var(--pv-surface))] text-(--pv-success)">
            <CheckCircle size={40} weight="fill" />
          </span>

          <h1 className="section-title mt-6">
            {name === null ? "Welcome aboard!" : `Welcome aboard, ${name}!`}
          </h1>
          <p className="mt-4 leading-7 text-(--pv-muted)">
            Your Pouch Villa account is ready. Your orders, saved products and delivery details all
            live here from now on.
          </p>

          <ul className="mt-7 grid gap-2 text-left text-sm">
            <Perk>Track every order from one place</Perk>
            <Perk>Keep the products you like</Perk>
            <Perk>Check out without retyping your details</Perk>
          </ul>

          <Link href={next} replace className="button-primary mt-8 w-full">
            Continue to {continuing}
          </Link>
          <p className="mt-3 text-xs text-(--pv-muted)">Taking you there in a moment…</p>
        </div>

        <ContinueToAccount href={next} />
      </div>
    </section>
  );
}

function Perk({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5 rounded-xl bg-(--pv-wash) px-4 py-3">
      <CheckCircle size={18} weight="fill" className="mt-0.5 shrink-0 text-(--pv-red)" />
      <span>{children}</span>
    </li>
  );
}
