"use client";

import { useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { DeviceMobile, MagnifyingGlass } from "@phosphor-icons/react";
import { filterDevices, type DeviceLike } from "@pv/backend/domain/device-match";
import { cn } from "@/lib/utils";

export type FinderDevice = DeviceLike & { id: string };

const MAX_SUGGESTIONS = 8;

/**
 * "Which phone have you got?" — type the model, get the pouches that fit it.
 *
 * This replaces a rail of every device the shop stocks for, which scrolled
 * sideways on a phone and hid every model past the right edge with nothing on
 * screen to say they were there. A rail also gets worse with every model staff
 * add; a text box gets better, because more stock means more chance the thing
 * someone types is in the list.
 *
 * Built as a real combobox rather than a `<select>`: a native select on Android
 * opens a full-screen list with no way to type, which is the one interaction
 * that matters here. The list is filtered in memory — it is one small row per
 * model, loaded with the page — so there is no request per keystroke and the
 * suggestions keep up on a slow connection.
 *
 * Submitting navigates to the shop's existing `device` filter, so every result
 * has a URL a shopper can share, bookmark, or reach with the back button.
 */
export function DeviceFinder({
  devices,
  activeSlug = "",
  categorySlug = "",
  autoFocus = false,
}: {
  devices: readonly FinderDevice[];
  activeSlug?: string;
  categorySlug?: string;
  autoFocus?: boolean;
}) {
  const router = useRouter();
  const listId = useId();
  const field = useRef<HTMLInputElement>(null);

  const active = devices.find((device) => device.slug === activeSlug) ?? null;
  const [term, setTerm] = useState(active === null ? "" : `${active.brandName} ${active.name}`);
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);

  const suggestions = useMemo(
    () => filterDevices(term, devices).slice(0, MAX_SUGGESTIONS),
    [term, devices],
  );

  if (devices.length === 0) return null;

  const go = (device: FinderDevice) => {
    const query = new URLSearchParams();
    if (categorySlug) query.set("category", categorySlug);
    query.set("device", device.slug);
    setTerm(`${device.brandName} ${device.name}`);
    setOpen(false);
    field.current?.blur();
    router.push(`/shop?${query.toString()}`);
  };

  const clear = () => {
    setTerm("");
    setOpen(false);
    const query = new URLSearchParams();
    if (categorySlug) query.set("category", categorySlug);
    const suffix = query.toString();
    router.push(suffix ? `/shop?${suffix}` : "/shop");
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (suggestions.length === 0) return;
      setOpen(true);
      setHighlighted((current) => {
        const step = event.key === "ArrowDown" ? 1 : -1;
        return (current + step + suggestions.length) % suggestions.length;
      });
      return;
    }
    if (event.key === "Enter") {
      // Only ever navigates to a device that is really in the list. Guessing
      // from free text would send someone to an empty shop and call it a result.
      const choice = suggestions[highlighted] ?? suggestions[0];
      if (choice !== undefined) {
        event.preventDefault();
        go(choice);
      }
      return;
    }
    if (event.key === "Escape") setOpen(false);
  };

  const expanded = open && suggestions.length > 0;

  return (
    <div className="relative">
      <label htmlFor={`${listId}-field`} className="label">
        Which phone have you got?
      </label>
      {/*
        ARIA 1.2 puts `combobox` on the input itself rather than on a wrapper —
        the earlier 1.0 pattern, which wrapped the field in the role, is what
        makes a screen reader announce the group instead of the text box.
      */}
      <div className="relative">
        <DeviceMobile
          size={20}
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-(--pv-muted)"
        />
        <input
          ref={field}
          id={`${listId}-field`}
          type="text"
          role="combobox"
          value={term}
          autoFocus={autoFocus}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          enterKeyHint="search"
          aria-expanded={expanded}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={expanded ? `${listId}-option-${highlighted}` : undefined}
          aria-describedby={`${listId}-hint`}
          placeholder="Search your model, e.g. iPhone 13"
          className="field field-icon min-h-11 w-full"
          onChange={(event) => {
            setTerm(event.target.value);
            setHighlighted(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          // A blur that fires before the click lands would close the list out
          // from under the tap, so the close waits a frame for the choice.
          onBlur={() => window.setTimeout(() => setOpen(false), 120)}
          onKeyDown={onKeyDown}
        />
      </div>

      <p id={`${listId}-hint`} className="help mt-1.5">
        {active === null
          ? "Pick your phone and we will show only what fits it."
          : `Showing what fits your ${active.brandName} ${active.name}.`}
      </p>

      {active !== null ? (
        <button type="button" onClick={clear} className="mt-2 text-sm font-bold text-(--pv-red)">
          Show every device
        </button>
      ) : null}

      {/*
        Announced to assistive technology whether or not it is visible, so a
        screen-reader user hears the count change as they type rather than only
        discovering an empty list on arrow-down.
      */}
      <span aria-live="polite" className="sr-only">
        {expanded
          ? `${suggestions.length} ${suggestions.length === 1 ? "device" : "devices"} available`
          : ""}
      </span>

      <ul
        id={listId}
        role="listbox"
        aria-label="Matching devices"
        hidden={!expanded}
        className="absolute z-30 mt-1.5 max-h-72 w-full overflow-y-auto rounded-2xl border border-(--pv-line) bg-(--pv-surface) py-1.5 shadow-(--pv-shadow) shadow-lg"
      >
        {/*
          `role="option"` sits on the <li> itself, not on a button inside it: a
          listbox must contain options as its own children, and wrapping each in
          a focusable control also breaks the pattern — focus stays in the text
          box throughout and `aria-activedescendant` says which option is current.
        */}
        {suggestions.map((device, index) => (
          <li
            key={device.id}
            id={`${listId}-option-${index}`}
            role="option"
            aria-selected={index === highlighted}
            // Stops the field blurring before the click resolves, which would
            // close the list out from under the tap.
            onMouseDown={(event) => event.preventDefault()}
            onMouseEnter={() => setHighlighted(index)}
            onClick={() => go(device)}
            className={cn(
              "flex min-h-11 cursor-pointer items-center gap-2 px-4 text-sm",
              index === highlighted ? "bg-(--pv-wash)" : "",
              device.slug === activeSlug ? "font-bold text-(--pv-red)" : "",
            )}
          >
            <MagnifyingGlass size={15} aria-hidden="true" className="shrink-0 text-(--pv-muted)" />
            <span className="truncate">
              <span className="text-(--pv-muted)">{device.brandName}</span> {device.name}
            </span>
          </li>
        ))}
      </ul>

      {open && term.trim() !== "" && suggestions.length === 0 ? (
        <p className="mt-2 text-sm text-(--pv-muted)">
          No match for “{term.trim()}”. Try the brand and model, like “Samsung A54”.
        </p>
      ) : null}
    </div>
  );
}
