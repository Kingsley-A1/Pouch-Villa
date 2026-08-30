import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";

export function StoreFooter() {
  return (
    <footer className="mt-16 bg-zinc-950 text-white">
      <div className="container-shell grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <BrandMark inverse />
          <p className="mt-5 max-w-md text-sm leading-6 text-zinc-400">
            Pouches, protection and gadget accessories. Order online and pay by transfer.
          </p>
        </div>
        <div>
          <p className="mb-4 text-xs font-bold tracking-[.14em] text-zinc-500 uppercase">Explore</p>
          <div className="grid gap-3 text-sm text-zinc-300">
            <Link href="/shop">Shop all</Link>
            <Link href="/categories">Categories</Link>
            <Link href="/search">Search</Link>
          </div>
        </div>
        <div>
          <p className="mb-4 text-xs font-bold tracking-[.14em] text-zinc-500 uppercase">
            Information
          </p>
          <div className="grid gap-3 text-sm text-zinc-300">
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
          </div>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="container-shell py-5 text-xs text-zinc-500">
          <span>&copy; {new Date().getFullYear()} Pouch Villa</span>
        </div>
      </div>
    </footer>
  );
}
