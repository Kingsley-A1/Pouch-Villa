import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { MINIMUM_PASSWORD_LENGTH } from "@pv/backend/auth/password";
import { getCustomerPrincipal } from "@/server/customer-session";
import { RegisterForm } from "../auth-forms";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Create an account" };

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  if ((await getCustomerPrincipal()) !== null) redirect("/account");

  const next = typeof params.next === "string" ? params.next : "/account";

  return (
    <section className="section-space">
      <div className="container-shell max-w-md">
        <h1 className="section-title">Create an account</h1>
        {/*
          Said plainly, because it is unusual and it is good news: per ADR 0002
          there is no email to go and confirm. Someone who expects one would
          otherwise sit waiting for it instead of shopping.
        */}
        <p className="mt-3 text-(--pv-muted)">
          No confirmation email to wait for. You can start shopping straight away.
        </p>
        <div className="mt-8">
          <RegisterForm
            googleClientId={process.env.GOOGLE_CLIENT_ID ?? null}
            next={next}
            passwordHint={`At least ${MINIMUM_PASSWORD_LENGTH} characters. Avoid one you use elsewhere.`}
          />
        </div>
      </div>
    </section>
  );
}
