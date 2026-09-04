import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";

/**
 * The bottom of every storefront page.
 *
 * It used to carry a delivery credit for the engineering partner. The client
 * asked for it to go (docs/client-inputs.md §6, 2026-09-04) — the footer of
 * their shop is theirs, and an outbound link there competes with the only two
 * things it should be doing: helping a shopper find a page, and saying who they
 * are buying from.
 */
export function StoreFooter() {
  return (
    <footer className="mt-16 bg-(--pv-footer-bg) text-(--pv-footer-ink)">
      <div className="container-shell grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <BrandMark />
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
          {/*
            No theme toggle. The storefront is brand red in both themes — a
            brand is not a preference — so the control had two settings that
            looked identical, which is worse than not offering it. The tokens
            for light and dark are still defined and still drive the admin.
          */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
            <span>&copy; {new Date().getFullYear()} Pouch Villa</span>
          </div>
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
    // Sized in CSS, not in attributes. `height` is an SVG *length*, and `auto`
    // is not one — Chromium rejected it with `<svg> attribute height: Expected
    // length, "auto"` on every page that renders this footer, which is every
    // page of the shop. That single error is what scored Lighthouse's
    // `errors-in-console` audit 0 on all four measured URLs.
    //
    // `h-auto` is the same intent expressed where it is legal: as CSS, `auto`
    // resolves against the intrinsic ratio the `viewBox` already declares, so
    // the wordmark still scales exactly as before.
    <svg
      viewBox="0 0 1000 100"
      aria-hidden="true"
      focusable="false"
      className="block h-auto w-full opacity-[0.09]"
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
