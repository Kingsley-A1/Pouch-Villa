import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCustomerProfile } from "@pv/backend/services/customer-account";
import { MINIMUM_PASSWORD_LENGTH } from "@pv/backend/auth/password";
import { getCustomerPrincipal } from "@/server/customer-session";
import { PasswordForm, ProfileForm } from "./details-forms";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your details" };

export default async function AccountDetailsPage() {
  const principal = await getCustomerPrincipal();
  if (principal === null) notFound();

  const profile = await getCustomerProfile(principal.customerId);
  if (profile === null) notFound();

  const passwordHint = `At least ${MINIMUM_PASSWORD_LENGTH} characters. Avoid one you use elsewhere.`;

  return (
    <div className="grid max-w-lg gap-10">
      <section>
        <h2 className="text-lg font-bold">Your details</h2>
        <div className="mt-4">
          <ProfileForm fullName={profile.fullName} phone={profile.phone} email={profile.email} />
        </div>
      </section>

      <section className="border-t border-(--pv-line) pt-8">
        <h2 className="text-lg font-bold">
          {profile.hasPassword ? "Change your password" : "Set a password"}
        </h2>
        {!profile.hasPassword ? (
          <p className="mt-2 text-sm text-(--pv-muted)">
            You sign in with Google. Setting a password gives you a second way in.
          </p>
        ) : null}
        <div className="mt-4">
          <PasswordForm hasPassword={profile.hasPassword} passwordHint={passwordHint} />
        </div>
      </section>
    </div>
  );
}
