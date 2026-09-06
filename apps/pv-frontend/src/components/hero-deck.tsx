import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import type { HeroSlide } from "@pv/backend/services/hero-slides";
import { cn } from "@/lib/utils";
import { DeckControls } from "./deck-controls";

/** The id the controls island reaches the track by. */
export const DECK_TRACK_ID = "pv-hero-track";

/**
 * The top of the home page: full-bleed photographs with the headline over them.
 *
 * **No carousel library.** The track is a CSS grid with `scroll-snap-type: x
 * mandatory`, so swiping works natively and the whole thing is usable with
 * JavaScript disabled — every slide is reachable by scrolling the track. The
 * only script is autoplay and the dots' current state, which comes to about a
 * kilobyte. Slick plus jQuery, which the reference site uses, is around 120 KB
 * on its own and would eat most of the §2 script budget before a product loads.
 *
 * **Nothing here fades in.** The photograph is the largest element on the page,
 * which makes it the LCP element on the route we are furthest from passing.
 * Slide one is `priority`; the rest are lazy. Only the text over the picture
 * animates, and text is never the LCP element on a page with a full-bleed
 * photograph.
 *
 * **Delays are utility classes, never `style` attributes.** `style-src-attr`
 * cannot be addressed by a nonce, so `lib/security-headers.ts` allows exactly
 * next/image's own declarations by hash and nothing else, and
 * `scripts/verify-routes.mjs` fails the build on any style attribute outside
 * that list. A per-word `animation-delay` written inline would break the build —
 * which is also why no off-the-shelf carousel can be used here, since they all
 * write inline transforms during server render.
 */
export function HeroDeck({ slides }: { slides: HeroSlide[] }) {
  if (slides.length === 0) return null;

  return (
    <section className="relative" aria-roledescription="carousel" aria-label="Featured">
      <div id={DECK_TRACK_ID} className="pv-deck-track">
        {slides.map((slide, index) => (
          <article
            key={slide.id}
            className={cn("pv-slide", index === 0 && "is-on")}
            aria-roledescription="slide"
            aria-label={`${index + 1} of ${slides.length}`}
          >
            <Image
              src={slide.image.url}
              alt=""
              fill
              sizes="100vw"
              // The first slide is the LCP candidate, so it is fetched at the
              // highest priority and never lazy. The others must not compete
              // with it for bandwidth on a 3G connection.
              priority={index === 0}
              loading={index === 0 ? "eager" : "lazy"}
              className="pv-slide-photo object-cover"
            />

            <div className="pv-slide-body">
              {slide.kicker === null ? null : (
                <span className="pv-slide-kicker">{slide.kicker}</span>
              )}
              <p className="pv-slide-title">
                {/*
                  Word by word, so the headline arrives rather than appearing.
                  Each word is its own inline-block with a delay class; five is
                  where the stagger stops, because past that the last word of a
                  long headline lands noticeably after the button under it.
                */}
                {slide.headline.split(/\s+/).map((word, position) => (
                  <span key={`${word}-${position}`} className={cn("pv-w", riseDelay(position))}>
                    {word}
                  </span>
                ))}
              </p>
              <Link href={slide.href} className="pv-slide-cta">
                {slide.ctaLabel ?? "Shop now"}
                <ArrowRight aria-hidden="true" size={16} weight="bold" />
              </Link>
            </div>
          </article>
        ))}
      </div>

      {slides.length > 1 ? <DeckControls count={slides.length} trackId={DECK_TRACK_ID} /> : null}
    </section>
  );
}

/**
 * A class rather than a computed `animation-delay`, because an inline `style`
 * would need `style-src-attr 'unsafe-inline'`. Tailwind's arbitrary values
 * compile to real classes, so they are safe here where a `style` attribute is not.
 */
function riseDelay(position: number): string {
  const steps = [
    "[animation-delay:0ms]",
    "[animation-delay:60ms]",
    "[animation-delay:120ms]",
    "[animation-delay:180ms]",
    "[animation-delay:240ms]",
  ];
  return steps[Math.min(position, steps.length - 1)] ?? steps[0]!;
}
