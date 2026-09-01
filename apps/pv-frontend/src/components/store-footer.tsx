import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { BrandMark } from "@/components/brand-mark";

export function StoreFooter() {
  return (
    <footer className="mt-16 bg-(--pv-footer-bg) text-(--pv-footer-ink)">
      <div className="container-shell grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <BrandMark inverse />
          <p className="mt-5 max-w-md text-sm leading-6 text-(--pv-footer-soft)">
            Pouches, protection and gadget accessories. Order online and pay by transfer.
          </p>
        </div>
        <div>
          <p className="mb-4 text-xs font-bold tracking-[.14em] text-(--pv-footer-muted) uppercase">
            Explore
          </p>
          <div className="grid gap-3 text-sm text-(--pv-footer-soft)">
            <Link href="/shop">Shop all</Link>
            <Link href="/categories">Categories</Link>
            <Link href="/search">Search</Link>
          </div>
        </div>
        <div>
          <p className="mb-4 text-xs font-bold tracking-[.14em] text-(--pv-footer-muted) uppercase">
            Information
          </p>
          <div className="grid gap-3 text-sm text-(--pv-footer-soft)">
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
          </div>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="container-shell flex flex-wrap items-center justify-between gap-4 py-5 text-xs text-(--pv-footer-muted)">
          <span>&copy; {new Date().getFullYear()} Pouch Villa</span>
          <ThemeToggle />
        </div>
      </div>
    </footer>
  );
}
