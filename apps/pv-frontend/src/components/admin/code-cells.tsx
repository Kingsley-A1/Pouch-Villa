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

  const setCharacter = (index: number, character: string) => {
    const next = characters.slice();
    next[index] = character;
    write(next.join("").trimEnd());
  };

  return (
    <div
      role="group"
      aria-labelledby={`${groupId}-label`}
      className="flex flex-wrap justify-center gap-1.5 sm:gap-2"
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
            // The last character typed, not the first: typing over a filled cell
            // should replace it rather than being ignored.
            const typed = clean(event.target.value).slice(-1);
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
            // A pasted code arrives whole, and a code copied from the admin
            // carries its display hyphen. Both are spread across the cells.
            event.preventDefault();
            const pasted = clean(event.clipboardData.getData("text"));
            if (pasted === "") return;
            const next = characters.slice();
            for (let offset = 0; index + offset < CODE_LENGTH && offset < pasted.length; offset++) {
              next[index + offset] = pasted[offset] ?? "";
            }
            write(next.join("").trimEnd());
            focusCell(index + pasted.length);
          }}
          className={cn(
            "h-12 w-9 rounded-none border border-(--pv-line) bg-(--pv-surface) text-center",
            "text-lg font-bold uppercase sm:w-11",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--pv-red)",
          )}
        />
      ))}
    </div>
  );
}
