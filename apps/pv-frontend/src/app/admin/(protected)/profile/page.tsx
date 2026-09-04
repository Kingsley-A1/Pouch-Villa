import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getStaffProfile } from "@pv/backend/services/staff-profile";
import { MINIMUM_PASSWORD_LENGTH } from "@pv/backend/auth/password";
import { requireStaffPrincipal } from "@/server/session";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { initialsForName } from "@/lib/initials";
import { StaffPasswordForm, StaffProfileForm } from "./profile-forms";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your profile" };

/**
 * Africa/Lagos, not the server's zone and not the browser's — §6. Two people
 * looking at the same account see the same dates.
 */
const DATE = new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeZone: "Africa/Lagos" });
const DATE_TIME = new Intl.DateTimeFormat("en-NG", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Africa/Lagos",
});

/**
 * A staff member's own account.
 *
 * No permission is required past being signed in. Every mutation behind this
 * screen is scoped to the session's own staff id, so an Employee editing their
 * own name is not exercising authority — and gating it on `staff.manage` would
 * have meant only the people who manage others could correct their own spelling.
 */
export default async function StaffProfilePage() {
  const principal = await requireStaffPrincipal();
  const profile = await getStaffProfile(principal.staffId);
  // The session was verified against this row a moment ago, so a miss here means
  // the account was deleted mid-request rather than a routing mistake.
  if (profile === null) notFound();

  const signInMethods = [
    profile.hasPassword ? "Email and password" : null,
    profile.hasGoogle ? "Google" : null,
  ].filter((method): method is string => method !== null);

  return (
    <div className="grid gap-8">
      <Breadcrumbs trail={[{ label: "Your profile" }]} />

      <div className="flex flex-wrap items-center gap-4">
        <span
          aria-hidden="true"
          className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-(--pv-red) text-lg font-extrabold text-(--pv-on-brand)"
        >
          {initialsForName(profile.fullName)}
        </span>
        <div>
          <h1 className="text-2xl font-bold">{profile.fullName}</h1>
          <p className="mt-0.5 text-sm text-(--pv-muted)">
            {profile.role} · joined {DATE.format(profile.memberSince)}
          </p>
        </div>
      </div>

      {/*
        Facts about the account rather than fields, so what can be changed and
        what cannot are visibly different things.
      */}
      <dl className="grid gap-3 sm:grid-cols-3">
        <Fact label="Email verified" value={profile.emailVerified ? "Yes" : "Not yet"} />
        <Fact
          label="Ways you sign in"
          // Never an empty string where a fact belongs — §0 rule 2. An account
          // with neither is not reachable, but saying so is better than a blank.
          value={signInMethods.length === 0 ? "None recorded" : signInMethods.join(" · ")}
        />
        <Fact
          label="Last signed in"
          value={
            profile.lastLoginAt === null ? "No record yet" : DATE_TIME.format(profile.lastLoginAt)
          }
        />
      </dl>

      <section className="grid gap-4">
        <h2 className="text-lg font-bold">Your details</h2>
        <StaffProfileForm
          fullName={profile.fullName}
          phone={profile.phone}
          email={profile.email}
          role={profile.role}
        />
      </section>

      <section className="grid gap-4">
        <h2 className="text-lg font-bold">
          {profile.hasPassword ? "Change your password" : "Set a password"}
        </h2>
        {profile.hasPassword ? null : (
          <p className="text-sm text-(--pv-muted)">
            You sign in with Google. Setting a password gives you a second way in.
          </p>
        )}
        <StaffPasswordForm
          hasPassword={profile.hasPassword}
          passwordHint={`At least ${MINIMUM_PASSWORD_LENGTH} characters. Avoid one you use elsewhere.`}
        />
      </section>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-(--pv-line) bg-(--pv-surface) p-4">
      <dt className="text-xs font-bold tracking-wide text-(--pv-muted) uppercase">{label}</dt>
      <dd className="mt-1 text-sm font-semibold">{value}</dd>
    </div>
  );
}
