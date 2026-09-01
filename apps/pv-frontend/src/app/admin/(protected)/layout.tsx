import Link from "next/link";
import { requireStaffPrincipal } from "@/server/session";
import { permissionsForRole } from "@pv/backend/services/roles";
import { BrandMark } from "@/components/brand-mark";
import { ConnectionStatus } from "@/components/connection-status";
import { AdminMobileNav } from "./admin-mobile-nav";
import { AdminSidebar } from "./admin-sidebar";
import { LogoutButton } from "./logout-button";
import { NAV_SECTIONS } from "./nav-sections";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const principal = await requireStaffPrincipal();
  const granted = new Set(await permissionsForRole(principal.role));
  const sections = NAV_SECTIONS.filter((item) => granted.has(item.permission));

  return (
    <div className="min-h-dvh bg-(--pv-wash)">
      <header className="sticky top-0 z-40 border-b border-(--pv-line) bg-white">
        <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6">
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

      <ConnectionStatus />

      {!principal.emailVerified ? (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-center text-sm text-amber-900">
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
