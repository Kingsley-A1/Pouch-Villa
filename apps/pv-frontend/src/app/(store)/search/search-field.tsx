"use client";

import { useEffect, useRef } from "react";

/**
 * The search box, focused on arrival.
 *
 * Tapping search in the header is an unambiguous statement of intent: the next
 * thing that should happen is a keyboard. Landing on a page with a box you then
 * have to aim at costs a tap on the smallest target on the screen.
 *
 * Only when the box is empty, though. Coming back to results — from a product,
 * or from the back button — the term is already there and the results are what
 * the person came to read; opening the keyboard over them would cover the answer
 * they just asked for.
 *
 * `preventScroll` because focusing an element the browser has restored a scroll
 * position for otherwise yanks the page back to the top.
 */
export function SearchField({ term }: { term: string }) {
  const field = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (term !== "") return;
    field.current?.focus({ preventScroll: true });
  }, [term]);

  return (
    <input
      ref={field}
      id="q"
      name="q"
      type="search"
      defaultValue={term}
      // Nothing here is a secret, and the phone's own history is the fastest way
      // back to a search someone has run before.
      autoComplete="off"
      enterKeyHint="search"
      placeholder="What are you looking for?"
      className="field min-h-11 flex-1"
    />
  );
}
