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
            <div className="hidden items-center gap-2.5 sm:flex">
              <span
                aria-hidden="true"
                className="grid h-10 w-10 place-items-center rounded-full bg-(--pv-red) text-xs font-extrabold text-(--pv-on-brand)"
              >
                {initialsForName(principal.fullName)}
              </span>
              <div className="text-right">
                <p className="text-sm font-bold">{principal.fullName}</p>
                <p className="text-xs text-(--pv-muted)">{principal.role}</p>
              </div>
            </div>
            <LogoutButton />
            <AdminMobileNav sections={sections} />
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
