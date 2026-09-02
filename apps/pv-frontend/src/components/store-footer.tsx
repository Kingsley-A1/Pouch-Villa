import Link from "next/link";
import Image from "next/image";
import { ThemeToggle } from "@/components/theme-toggle";
import { BrandMark } from "@/components/brand-mark";

/**
 * Who built this, and where to find them.
 *
 * Deliberately not in the settings store with the shop's own facts. §4 protects
 * things that are *Pouch Villa's* to change — an address, a phone number, a
 * price. This is Bespoke Technologies' delivery attribution, agreed with the
 * client (docs/archive/pouchhub-prototype/assumptions-and-confirmations.md), and
 * it is not the shopkeeper's to edit from the admin.
 */
const PARTNER = {
  name: "Bespoke Technologies",
  role: "Engineering partner",
  site: "https://bespoketech.com.ng",
  label: "bespoketech.com.ng",
} as const;

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
            <Link href="/about">About us</Link>
            <Link href="/returns">Returns &amp; warranty</Link>
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
          </div>
        </div>
      </div>

      <div className="container-shell pb-2">
        <FooterWordmark />
      </div>

      <div className="border-t border-white/10">
        <div className="container-shell flex flex-col gap-5 py-5 text-xs text-(--pv-footer-muted) sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
            <span>&copy; {new Date().getFullYear()} Pouch Villa</span>
            <ThemeToggle />
          </div>
          <PartnerCredit />
        </div>
      </div>
    </footer>
  );
}

/**
 * The shop's name at full bleed, held back to a whisper.
 *
 * Drawn as SVG text with `textLength` rather than sized in `vw`: the wordmark
 * then fills the container exactly at every width, from 320 px to 1280, and it
 * keeps doing so if the display face is ever swapped — a `vw` size has to be
 * re-tuned per breakpoint and still guesses at the font's own metrics.
 *
 * Purely decorative, so it is hidden from assistive technology: the same words
 * are already the footer's first heading, and hearing "Pouch Villa" twice in a
 * row tells a screen-reader user nothing new.
 */
function FooterWordmark() {
  return (
    <svg
      viewBox="0 0 1000 100"
      width="100%"
      height="auto"
      aria-hidden="true"
      focusable="false"
      className="block opacity-[0.09]"
    >
      <text
        x="0"
        y="90"
        textLength="1000"
        lengthAdjust="spacingAndGlyphs"
        fontSize="110"
        fontWeight="900"
        fill="currentColor"
        className="font-(family-name:--pv-font-hero-stack)"
      >
        POUCH VILLA
      </text>
    </svg>
  );
}

function PartnerCredit() {
  return (
    <a
      href={PARTNER.site}
      // A link off this site opens in a new tab so a shopper does not lose the
      // cart they were halfway through. `noreferrer` also covers `noopener`,
      // which is what keeps the new tab from reaching back through `window.opener`.
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-3 self-start rounded-2xl border border-white/12 bg-white/5 py-2.5 pr-4 pl-2.5 transition-colors hover:border-white/25 hover:bg-white/10"
    >
      {/*
        The mark alone, not the full horizontal lockup. At the size a footer
        credit can afford, the lockup's own wordmark renders about five pixels
        tall and is unreadable, so the name is set in real text beside the mark
        instead. The mark is black and blue on white, so on this near-black band
        it keeps its own light ground rather than disappearing into the footer.
        Intrinsic dimensions are passed through, so the box is reserved before
        the file arrives and the image costs nothing in CLS.
      */}
      <span className="grid shrink-0 place-items-center rounded-xl bg-white p-1.5">
        <Image
          src="/images/bespoke-technologies-mark.png"
          alt=""
          width={240}
          height={240}
          sizes="72px"
          className="h-8 w-8"
        />
      </span>
      <span className="min-w-0">
        <span className="block text-[11px] font-bold tracking-[.14em] text-(--pv-footer-muted) uppercase">
          {PARTNER.role}
        </span>
        <span className="block truncate text-sm font-bold text-(--pv-footer-ink)">
          {PARTNER.name}
        </span>
        <span className="block truncate text-(--pv-footer-muted)">{PARTNER.label}</span>
      </span>
    </a>
  );
}
