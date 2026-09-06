"use client";

import { useEffect, useRef } from "react";

const SEEN_KEY = "pv-headline-typed";

/**
 * Types the opening line out, once, on a visitor's first arrival.
 *
 * **Three things it deliberately does not do.**
 *
 * It does not change the size of anything. The full sentence is always in the
 * DOM as an invisible ghost that holds the exact box the finished line occupies,
 * and the typed characters are painted over it. Typing into a collapsing box
 * would relayout the page on nearly every keystroke, which is the worst possible
 * source of CLS — on the one element most likely to be the largest on the page.
 *
 * It does not hide the sentence from anybody who is not watching an animation.
 * A screen reader reads the real text from the ghost; the animated copy is
 * `aria-hidden`, so nothing is announced letter by letter.
 *
 * It does not run twice. `localStorage` records that it has played, so a
 * returning visitor gets the finished sentence immediately — an animation that
 * replays on every navigation stops being a welcome and becomes a delay.
 *
 * **Why it writes to the DOM rather than holding state.** A character is a
 * `textContent` assignment, not a React render: typing a 60-character headline
 * through `useState` would re-render this subtree sixty times in under a second
 * on the mid-range Android this shop is actually used on, for a result identical
 * to setting the text directly. It is also what keeps the effect free of the
 * set-state-in-effect pattern the lint rule exists to prevent.
 *
 * It never runs under `prefers-reduced-motion`, and the server renders the
 * finished sentence — so a browser with JavaScript off, a returning visitor and
 * a crawler all get the whole line with no animation and no flash.
 */
export function TypedHeadline({ text, className }: { text: string; className?: string }) {
  const typed = useRef<HTMLSpanElement>(null);
  const caret = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const line = typed.current;
    // Both refs are copied here rather than read in the cleanup: by the time
    // cleanup runs React may have swapped the nodes out from under them.
    const cursor = caret.current;
    if (line === null) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    try {
      if (window.localStorage.getItem(SEEN_KEY) === "1") return;
      window.localStorage.setItem(SEEN_KEY, "1");
    } catch {
      // A browser blocking storage gets the finished line rather than the
      // animation on every page — the quieter of the two failures.
      return;
    }

    // Paced to finish inside roughly a second however long the CEO's headline
    // is. A fixed per-character delay would take three seconds on a long one,
    // and this is the element the page is judged on for LCP.
    const step = Math.max(12, Math.min(45, Math.round(900 / Math.max(text.length, 1))));
    let position = 0;

    line.textContent = "";
    if (cursor !== null) cursor.hidden = false;

    const timer = window.setInterval(() => {
      position += 1;
      line.textContent = text.slice(0, position);
      if (position >= text.length) {
        window.clearInterval(timer);
        if (cursor !== null) cursor.hidden = true;
      }
    }, step);

    return () => {
      window.clearInterval(timer);
      // Whatever happens, the visitor is left with the whole sentence.
      line.textContent = text;
      if (cursor !== null) cursor.hidden = true;
    };
  }, [text]);

  return (
    <span className={className}>
      {/*
        The ghost: invisible, unreadable, and the only thing that decides how
        much room the headline takes. `visibility: hidden` rather than
        `opacity: 0` so it cannot be selected or hit-tested.
      */}
      <span className="invisible" aria-hidden="true">
        {text}
      </span>

      {/* The real sentence, for assistive technology, read once and in full. */}
      <span className="sr-only">{text}</span>

      <span aria-hidden="true" className="absolute inset-0">
        <span ref={typed}>{text}</span>
        {/*
          Hidden until typing starts, so a returning visitor never sees a caret
          blinking after a sentence that is already finished.
        */}
        <span ref={caret} hidden className="pv-caret pv-loop" />
      </span>
    </span>
  );
}
