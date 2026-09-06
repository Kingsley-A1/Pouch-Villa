"use client";

import { useId, useRef, useState } from "react";
import { MagnifyingGlass } from "@phosphor-icons/react";

/**
 * A search box that narrows the list already on the page.
 *
 * The client's instruction was that the search bar "not load like a page does".
 * Taken literally: this never navigates and never fetches. Every brand and every
 * model on a browse step is already in the HTML the server sent, so filtering
 * them is a DOM operation — the result appears on the keystroke, it works with a
 * dead connection, and there is no request per character to debounce.
 *
 * It filters the list it is standing next to. It is **not** a search of the
 * catalogue: `/search` is still the way to find something that is not on this
 * screen, and the empty state below says so rather than leaving someone typing
 * a product name into a list of brands and concluding the shop has nothing.
 *
 * The items stay Server Components. This island owns the input and toggles
 * `hidden` on elements carrying `data-filter-label` inside the named scope, so
 * no card is re-rendered in the browser and nothing about them ships as
 * JavaScript.
 */
export function InstantFilter({
  scope,
  label,
  placeholder,
  total,
}: {
  /** Matches the `data-filter-scope` on the list this filters. */
  scope: string;
  label: string;
  placeholder: string;
  /** Used for the "showing all N" reading before anything is typed. */
  total: number;
}) {
  const inputId = useId();
  const [shown, setShown] = useState(total);
  const [query, setQuery] = useState("");
  const frame = useRef<number | null>(null);

  function apply(value: string) {
    const needle = value.trim().toLowerCase();
    const container = document.querySelector(`[data-filter-scope="${scope}"]`);
    if (container === null) return;

    let visible = 0;
    for (const item of container.querySelectorAll<HTMLElement>("[data-filter-label]")) {
      const hay = (item.dataset["filterLabel"] ?? "").toLowerCase();
      const matches = needle.length === 0 || hay.includes(needle);
      // `hidden`, not `style.display`: the reset in the app shell makes it win,
      // and a hidden element is out of the accessibility tree and out of the tab
      // order, which is what "filtered out" should mean for a keyboard user.
      item.hidden = !matches;
      if (matches) visible += 1;
    }
    setShown(visible);
  }

  return (
    <div className="mt-6 grid gap-2">
      <label htmlFor={inputId} className="text-sm font-semibold">
        {label}
      </label>
      <div className="relative">
        <MagnifyingGlass
          aria-hidden="true"
          size={18}
          className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-(--pv-muted)"
        />
        <input
          id={inputId}
          type="search"
          className="field w-full pl-10"
          placeholder={placeholder}
          value={query}
          autoComplete="off"
          onChange={(event) => {
            const { value } = event.target;
            setQuery(value);
            // One filter pass per frame. Holding a key down fires far faster
            // than the screen refreshes, and on a mid-range Android that is the
            // difference between typing smoothly and typing through treacle.
            if (frame.current !== null) cancelAnimationFrame(frame.current);
            frame.current = requestAnimationFrame(() => apply(value));
          }}
        />
      </div>

      {/*
        Polite, so it is announced after the typing pauses rather than
        interrupting every keystroke.
      */}
      <p aria-live="polite" className="text-xs text-(--pv-muted)">
        {query.trim().length === 0
          ? `Showing all ${total}.`
          : shown === 0
            ? "Nothing here matches. Try the shop search for a product name."
            : `${shown} of ${total} shown.`}
      </p>
    </div>
  );
}
