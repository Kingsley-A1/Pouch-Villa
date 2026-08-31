import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getStaffPrincipal } from "@/server/session";
import { VerifyEmailForm } from "./verify-email-form";

export const metadata: Metadata = { title: "Verify your email" };

export default async function VerifyEmailPage() {
  const principal = await getStaffPrincipal();
  if (principal === null) redirect("/admin/login");
  if (principal.emailVerified) redirect("/admin");

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-10">
      <h1 className="text-2xl font-bold">Verify your email</h1>
      <p className="mt-2 text-sm text-(--pv-muted)">
        We sent a 6-digit code to <strong className="text-(--pv-ink)">{principal.email}</strong>.
        Enter it below.
      </p>
      <div className="mt-8">
        <VerifyEmailForm />
      </div>
    </div>
  );
}
