import Image from "next/image";
import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";

export function StoreFooter() {
  return (
    <footer className="mt-20 bg-[#171717] text-white">
      <div className="container-shell grid gap-10 py-14 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <BrandMark inverse />
          <p className="mt-5 max-w-md text-sm leading-6 text-zinc-400">
            A prototype digital storefront for discovering compatible phone cases, saving favourites
            and preparing pickup reservations.
          </p>
        </div>
        <div>
          <p className="mb-4 text-xs font-bold tracking-[.14em] text-zinc-500 uppercase">Explore</p>
          <div className="grid gap-3 text-sm text-zinc-300">
            <Link href="/shop">Shop all</Link>
            <Link href="/find-my-case">Find My Case</Link>
            <Link href="/collections">Collections</Link>
            <Link href="/request-case">Request a Case</Link>
          </div>
        </div>
        <div>
          <p className="mb-4 text-xs font-bold tracking-[.14em] text-zinc-500 uppercase">
            Information
          </p>
          <div className="grid gap-3 text-sm text-zinc-300">
            <Link href="/visit-us">Visit Us</Link>
            <Link href="/help">Help & FAQs</Link>
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
            <Link href="/admin/login">Staff sign in</Link>
          </div>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="container-shell flex flex-col gap-4 py-5 text-xs text-zinc-500 sm:flex-row sm:items-center sm:justify-between">
          <span>Prototype only. Client identity and operational details require confirmation.</span>
          <a
            href="https://www.bespoketech.com.ng"
            className="inline-flex items-center gap-2 text-zinc-400"
            target="_blank"
            rel="noreferrer"
          >
            <Image
              src="/images/bespoke-technologies-logo.png"
              alt="Bespoke Technologies"
              width={110}
              height={42}
              className="h-7 w-auto rounded bg-white object-contain px-1"
            />{" "}
            Built by Bespoke Technologies
          </a>
        </div>
      </div>
    </footer>
  );
}
