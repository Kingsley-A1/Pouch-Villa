"use client";

import { useEffect, useRef, useState } from "react";
import { CaretLeft, CaretRight } from "@phosphor-icons/react";

/**
 * Autoplay, arrows and dots for a slide deck — its only JavaScript.
 *
 * Shared by the hero and the category showcase. It knows nothing about what is
 * in the track: it scrolls a container by id, which is what lets the slides
 * themselves stay Server Components in both.
 *
 * It drives the track by scrolling it, rather than owning the slides. That is
 * what keeps the slides Server Components: no photograph, headline or link is
 * re-rendered in the browser, and with this island stripped out the deck is
 * still a horizontally scrollable strip that reaches every slide.
 *
 * **Autoplay never starts under `prefers-reduced-motion`,** and it stops for
 * good on the first hover, focus or touch: someone who has taken hold of the
 * deck has said what they want to look at, and moving it under them afterwards
 * is the behaviour that makes carousels hated.
 */
export function DeckControls({
  count,
  trackId,
  /** How long a slide holds before the next one. The hero rests longer than the
      category deck, which the client asked to move every two seconds. */
  intervalMs = 5200,
}: {
  count: number;
  trackId: string;
  intervalMs?: number;
}) {
  const [index, setIndex] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopped = useRef(false);

  useEffect(() => {
    const track = document.getElementById(trackId);
    if (track === null) return;

    const calm = window.matchMedia("(prefers-reduced-motion: reduce)");

    function stop() {
      stopped.current = true;
      if (timer.current !== null) {
        clearInterval(timer.current);
        timer.current = null;
      }
    }

    function current(): number {
      if (track === null) return 0;
      const middle = track.scrollLeft + track.clientWidth / 2;
      const slides = [...track.children] as HTMLElement[];
      const found = slides.findIndex(
        (slide) => slide.offsetLeft <= middle && slide.offsetLeft + slide.offsetWidth > middle,
      );
      return found < 0 ? 0 : found;
    }

    // `is-on` replays the headline entrance on whichever slide is showing. The
    // class is removed and re-added with a reflow between, because restarting a
    // CSS animation needs the element to leave and re-enter the animated state.
    function mark() {
      if (track === null) return;
      const active = current();
      setIndex(active);
      [...track.children].forEach((slide, position) => {
        if (position !== active) {
          slide.classList.remove("is-on");
          return;
        }
        if (!slide.classList.contains("is-on")) {
          void (slide as HTMLElement).offsetWidth;
          slide.classList.add("is-on");
        }
      });
    }

    let frame: number | null = null;
    function onScroll() {
      if (frame !== null) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(mark);
    }

    track.addEventListener("scroll", onScroll, { passive: true });
    track.addEventListener("pointerenter", stop);
    track.addEventListener("focusin", stop);
    track.addEventListener("touchstart", stop, { passive: true });

    if (!calm.matches) {
      timer.current = setInterval(() => {
        if (stopped.current) return;
        show((current() + 1) % count);
      }, intervalMs);
    }

    function show(next: number) {
      if (track === null) return;
      const slide = track.children[next] as HTMLElement | undefined;
      slide?.scrollIntoView({
        behavior: calm.matches ? "auto" : "smooth",
        block: "nearest",
        inline: "center",
      });
    }

    // Exposed so the buttons below can drive the same code path the timer does,
    // rather than each having its own idea of what "next" means.
    goTo.current = (next: number) => {
      stop();
      show(next);
    };

    return () => {
      track.removeEventListener("scroll", onScroll);
      track.removeEventListener("pointerenter", stop);
      track.removeEventListener("focusin", stop);
      track.removeEventListener("touchstart", stop);
      if (frame !== null) cancelAnimationFrame(frame);
      stop();
    };
  }, [count, trackId, intervalMs]);

  const goTo = useRef<(next: number) => void>(() => {});

  return (
    <>
      <button
        type="button"
        className="pv-deck-arrow left-3"
        aria-label="Previous slide"
        onClick={() => goTo.current((index - 1 + count) % count)}
      >
        <CaretLeft aria-hidden="true" size={18} weight="bold" />
      </button>
      <button
        type="button"
        className="pv-deck-arrow right-3"
        aria-label="Next slide"
        onClick={() => goTo.current((index + 1) % count)}
      >
        <CaretRight aria-hidden="true" size={18} weight="bold" />
      </button>

      <div className="pv-deck-dots">
        {Array.from({ length: count }, (_, position) => (
          <button
            key={position}
            type="button"
            // A 44 px hit area around a 4 px bar: the mark can be small, the
            // target cannot (§2).
            className="pv-deck-dot"
            aria-label={`Go to slide ${position + 1}`}
            aria-current={position === index}
            onClick={() => goTo.current(position)}
          >
            <span aria-hidden="true" className="pv-deck-dot-bar" />
          </button>
        ))}
      </div>
    </>
  );
}
