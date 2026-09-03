import type { Metadata } from "next";
import { GoogleSignInProblem, googleReason } from "@/components/google-sign-in-problem";
import { ClaimForm } from "./claim-form";

export const metadata: Metadata = { title: "Claim staff access" };

export default async function ClaimPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const googleClientId = process.env.GOOGLE_CLIENT_ID ?? null;

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-10">
      <h1 className="text-2xl font-bold">Claim staff access</h1>
      <p className="mt-2 text-sm text-(--pv-muted)">
        Enter the role code you were given. It creates your account and sets your access level —
        CEO, Manager or Employee.
      </p>
      <div className="mt-8 grid gap-5">
        <GoogleSignInProblem reason={googleReason(params.google)} />
        <ClaimForm googleClientId={googleClientId} />
      </div>
    </div>
  );
}
