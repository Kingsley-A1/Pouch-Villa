import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCustomerPrincipal } from "@/server/customer-session";
import { SignInForm } from "../auth-forms";
import { GoogleSignInProblem, googleReason } from "@/components/google-sign-in-problem";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Sign in" };

/** Confirmations of something that happened on the previous page. */
const NOTICES: Record<string, string> = {
  reset: "Your password has been changed. Sign in with your new one.",
  changed: "Your password has been changed. Sign in again on this device.",
  signedout: "You are signed out.",
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;

  // Already signed in: there is nothing for this page to do, and showing a
  // sign-in form to someone who is signed in reads as though they are not.
  if ((await getCustomerPrincipal()) !== null) redirect("/account");

  const next = typeof params.next === "string" ? params.next : "/account";
  const notice = Object.keys(NOTICES).find((key) => params[key] === "1");

  return (
    <section className="section-space">
      <div className="container-shell max-w-md">
        <h1 className="section-title">Sign in</h1>
        <p className="mt-3 text-(--pv-muted)">
          Track your orders, keep your details, and save what you like.
        </p>
        <div className="mt-8 grid gap-5">
          <GoogleSignInProblem reason={googleReason(params.google)} />
          <SignInForm
            googleClientId={process.env.GOOGLE_CLIENT_ID ?? null}
            next={next}
            notice={notice === undefined ? null : (NOTICES[notice] ?? null)}
          />
        </div>
      </div>
    </section>
  );
}
