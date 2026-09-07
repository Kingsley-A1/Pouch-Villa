"use client";

import { useId, useRef } from "react";
import { CODE_LENGTH } from "@pv/backend/auth/role-codes";
import { cn } from "@/lib/utils";

/**
 * A role code, as one box per character.
 *
 * Codes are shown grouped — `RVMQ-TQAF` — and staff were typing the hyphen with
 * them. The server strips it, so it always worked, but the field looked wrong
 * while they typed and there was nothing to say whether the separator belonged.
 * Eight boxes remove the question: there is nowhere to put a hyphen, and the
 * shape of the control tells you how long the answer is before you start.
 *
 * The cells are unnamed and a hidden input carries the joined value, so the form
 * still submits one `code` field and nothing downstream changes.
 *
 * Every cell is `required`, which is what makes a half-filled code fail in the
 * browser with a message pointing at the empty box rather than as a round trip
 * that comes back saying only "check the form".
 *
 * `autoComplete="one-time-code"` on the first cell lets a phone offer a code it
 * has seen; the paste handler is what makes that, and a copied code, land across
 * all eight rather than piling into the first.
 */
export function CodeCells({
  value,
  onChange,
  name,
}: {
  value: string;
  onChange: (next: string) => void;
  name: string;
}) {
  const groupId = useId();
  const cells = useRef<(HTMLInputElement | null)[]>([]);

  // Only the alphabet codes are minted from, so a typed O or I — the characters
  // the alphabet deliberately excludes because they are misread — is refused at
  // the keystroke rather than accepted and rejected by the server later.
  const clean = (raw: string) => raw.toUpperCase().replace(/[^A-Z0-9]/g, "");

  const characters = Array.from({ length: CODE_LENGTH }, (_, index) => value[index] ?? "");

  const write = (next: string) => onChange(next.slice(0, CODE_LENGTH));

  const focusCell = (index: number) => {
    const target = cells.current[Math.min(Math.max(index, 0), CODE_LENGTH - 1)];
    target?.focus();
    target?.select();
  };

  /**
   * Lays a run of characters across the boxes from `from` onwards.
   *
   * Shared by the paste handler and the change handler, because a paste reaches
   * one or the other depending on the keyboard — and two copies of this had
   * already started to differ in whether they moved the focus.
   */
  const spread = (from: number, run: string) => {
    if (run === "") return;
    const next = characters.slice();
    for (let offset = 0; from + offset < CODE_LENGTH && offset < run.length; offset += 1) {
      next[from + offset] = run[offset] ?? "";
    }
    write(next.join("").trimEnd());
    focusCell(from + run.length);
  };

  const setCharacter = (index: number, character: string) => {
    const next = characters.slice();
    next[index] = character;
    write(next.join("").trimEnd());
  };

  return (
    <div
      role="group"
      aria-labelledby={`${groupId}-label`}
      /*
        One row, always. Eight fixed-width boxes plus their gaps came to about
        330 px, which is wider than the claim panel on a 360 px screen — so they
        wrapped to six and two, and a code that is one thing looked like two.
        The boxes share the row instead: `flex-1` with `min-w-0` lets them shrink
        to fit whatever is left, and `max-w-12` stops them stretching into
        letterboxes on a desktop.
      */
      className="flex w-full items-center gap-1 sm:gap-2"
    >
      <span id={`${groupId}-label`} className="sr-only">
        Role code, {CODE_LENGTH} characters
      </span>
      <input type="hidden" name={name} value={value} />

      {characters.map((character, index) => (
        <input
          key={index}
          ref={(element) => {
            cells.current[index] = element;
          }}
          // No `name`: the hidden field above is what the form submits. Eight
          // named inputs would post eight separate values called `code`.
          id={index === 0 ? name : undefined}
          type="text"
          inputMode="text"
          autoComplete={index === 0 ? "one-time-code" : "off"}
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          required
          maxLength={1}
          aria-label={`Character ${index + 1} of ${CODE_LENGTH}`}
          value={character}
          onChange={(event) => {
            const incoming = clean(event.target.value);

            /*
              More than one character means this was a paste, not typing.

              Android's keyboards and clipboard menu often deliver a paste as an
              ordinary input event with the whole string in it and never fire a
              `paste` event at all — `maxLength` does not stop that, so without
              this the eight-character code landed as one character in one box
              and the rest was dropped. The paste handler below still exists for
              the browsers that do fire the event.
            */
            if (incoming.length > 1) {
              spread(index, incoming);
              return;
            }

            // The last character typed, not the first: typing over a filled cell
            // should replace it rather than being ignored.
            const typed = incoming.slice(-1);
            if (typed === "") {
              setCharacter(index, "");
              return;
            }
            setCharacter(index, typed);
            focusCell(index + 1);
          }}
          onKeyDown={(event) => {
            if (event.key === "Backspace" && character === "" && index > 0) {
              // An empty cell has nothing to delete, so backspace should step
              // back and clear the one that does — which is what people expect
              // and what makes a mistyped code fixable without the mouse.
              event.preventDefault();
              setCharacter(index - 1, "");
              focusCell(index - 1);
            }
            if (event.key === "ArrowLeft") {
              event.preventDefault();
              focusCell(index - 1);
            }
            if (event.key === "ArrowRight") {
              event.preventDefault();
              focusCell(index + 1);
            }
          }}
          onPaste={(event) => {
            event.preventDefault();
            spread(index, clean(event.clipboardData.getData("text")));
          }}
          className={cn(
            "h-12 min-w-0 flex-1 basis-0 rounded-none border border-(--pv-line) text-center",
            "max-w-12 bg-(--pv-surface) text-lg font-bold uppercase",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--pv-red)",
          )}
        />
      ))}
    </div>
  );
}
