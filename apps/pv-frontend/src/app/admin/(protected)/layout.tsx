import Link from "next/link";
import { requireStaffPrincipal } from "@/server/session";
import { permissionsForRole } from "@pv/backend/services/roles";
import { BrandMark } from "@/components/brand-mark";
import { AdminMobileNav } from "./admin-mobile-nav";
import { LogoutButton } from "./logout-button";
import { NAV_SECTIONS } from "./nav-sections";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const principal = await requireStaffPrincipal();
  const granted = new Set(await permissionsForRole(principal.role));
  const sections = NAV_SECTIONS.filter((item) => granted.has(item.permission));

  return (
    <div className="min-h-dvh bg-(--pv-wash)">
      <header className="sticky top-0 z-40 border-b border-(--pv-line) bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
          <Link href="/admin" aria-label="Admin home">
            <BrandMark compact />
          </Link>
          <div className="flex items-center gap-4">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-bold">{principal.fullName}</p>
              <p className="text-xs text-(--pv-muted)">{principal.role}</p>
            </div>
            <LogoutButton />
            <AdminMobileNav sections={sections} />
          </div>
        </div>
      </header>

      {!principal.emailVerified ? (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-center text-sm text-amber-900">
          Your email is not verified.{" "}
          <Link href="/admin/verify-email" className="font-bold underline">
            Verify now
          </Link>
        </div>
      ) : null}

      <div className="mx-auto flex max-w-6xl gap-6 px-4 py-6">
        <nav aria-label="Admin sections" className="hidden w-56 shrink-0 lg:block">
          <ul className="grid gap-1">
            {sections.map((section) => (
              <li key={section.href}>
                <Link
                  href={section.href}
                  className="flex min-h-11 items-center rounded-xl px-3 text-sm font-semibold text-(--pv-ink) hover:bg-white"
                >
                  {section.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <main className="min-w-0 flex-1 pb-16">{children}</main>
      </div>
    </div>
  );
}
