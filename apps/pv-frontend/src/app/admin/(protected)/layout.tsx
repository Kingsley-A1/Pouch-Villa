import Link from "next/link";
import { requireStaffPrincipal } from "@/server/session";
import { permissionsForRole } from "@pv/backend/services/roles";
import { BrandMark } from "@/components/brand-mark";
import { ConnectionStatus } from "@/components/connection-status";
import { AdminMobileNav } from "./admin-mobile-nav";
import { AdminSearch } from "@/components/admin/admin-search";
import { AdminSidebar } from "./admin-sidebar";
import { LogoutButton } from "./logout-button";
import { NAV_SECTIONS } from "./nav-sections";
import { initialsForName } from "@/lib/initials";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const principal = await requireStaffPrincipal();
  const granted = new Set(await permissionsForRole(principal.role));
  const sections = NAV_SECTIONS.filter((item) => granted.has(item.permission));

  return (
    <div className="min-h-dvh bg-(--pv-wash)">
      <header className="sticky top-0 z-40 border-b border-(--pv-line) bg-(--pv-surface)">
        <div className="flex h-16 items-center gap-3 px-4 sm:gap-4 sm:px-6 lg:grid lg:grid-cols-[minmax(10rem,1fr)_minmax(20rem,36rem)_minmax(10rem,1fr)]">
          <Link href="/admin" aria-label="Admin home" className="justify-self-start">
            <BrandMark compact />
          </Link>
          <AdminSearch sections={sections} />
          <div className="flex shrink-0 items-center gap-2 justify-self-end sm:gap-3">
            {/*
              The account controls, on desktop only.

              Below `lg` they crowded a 360 px bar that already carries a
              wordmark, a search field and a menu button — the avatar, the words
              "Sign out" and the hamburger sat in a row with nothing between
              them, and "Sign out" is a destructive action a thumb should not
              find by accident next to the menu it was reaching for. Both now
              live in the drawer, where the storefront already puts the account
              and where there is room to name them properly.

              The monogram is a link to your own profile. The accessible name
              carries the name and role that used to sit beside it as static
              text, so nothing is lost to a screen reader by the words going.
            */}
            <Link
              href="/admin/profile"
              aria-label={`Your profile — ${principal.fullName}, ${principal.role}`}
              className="hidden h-11 w-11 shrink-0 place-items-center rounded-full bg-(--pv-red) text-xs font-extrabold text-(--pv-on-brand) hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--pv-red) lg:grid"
            >
              <span aria-hidden="true">{initialsForName(principal.fullName)}</span>
            </Link>
            <span className="hidden lg:inline">
              <LogoutButton />
            </span>
            <AdminMobileNav
              sections={sections}
              account={{
                name: principal.fullName,
                role: principal.role,
                monogram: initialsForName(principal.fullName),
              }}
            />
          </div>
        </div>
      </header>

      <ConnectionStatus />

      {!principal.emailVerified ? (
        <div className="border-b border-[color-mix(in_srgb,var(--pv-warning)_35%,var(--pv-line))] bg-[color-mix(in_srgb,var(--pv-warning)_12%,var(--pv-surface))] px-4 py-2.5 text-center text-sm text-(--pv-warning)">
          Your email is not verified.{" "}
          <Link href="/admin/verify-email" className="font-bold underline">
            Verify now
          </Link>
        </div>
      ) : null}

      <div className="flex min-h-[calc(100dvh-4rem)]">
        <AdminSidebar sections={sections} />
        <main className="min-w-0 flex-1 pb-16">
          <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
