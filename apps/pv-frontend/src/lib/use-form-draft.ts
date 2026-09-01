"use client";

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";

const DEBOUNCE_MS = 600;

/**
 * Keeps an unsubmitted form recoverable across a reload, a crash, or a dropped
 * connection.
 *
 * Deliberately local-only. A half-filled product is not something to write to
 * the database — it would need a row that is neither a draft product nor
 * nothing — and on Nigerian mobile data a per-keystroke round trip is exactly
 * the cost we are trying to avoid. `localStorage` survives a reload and a
 * browser restart, costs no network, and is scoped to the one person typing.
 *
 * Files are never part of a draft: a `File` cannot be serialised, and quietly
 * restoring a form whose pictures are missing is worse than asking for them
 * again. The caller is told a draft exists and decides what to do about it.
 *
 * Every access is wrapped, because in a private window or with site data
 * blocked the accessor itself throws rather than returning null.
 */

const listeners = new Map<string, Set<() => void>>();

/**
 * Last parsed value per key, so `getSnapshot` returns a stable reference.
 * Re-parsing on every call would hand React a new object each time and spin it
 * in an infinite re-render.
 */
const parsedCache = new Map<string, { raw: string | null; value: unknown }>();

function notify(key: string) {
  parsedCache.delete(key);
  for (const listener of listeners.get(key) ?? []) listener();
}

function readDraft(key: string): unknown {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(key);
  } catch {
    raw = null;
  }

  const cached = parsedCache.get(key);
  if (cached !== undefined && cached.raw === raw) return cached.value;

  let value: unknown = null;
  if (raw !== null) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (parsed !== null && typeof parsed === "object") value = parsed;
    } catch {
      value = null;
    }
  }
  parsedCache.set(key, { raw, value });
  return value;
}

export function useFormDraft<T extends Record<string, unknown>>(
  key: string,
  { enabled = true }: { enabled?: boolean } = {},
) {
  const subscribe = useCallback(
    (onChange: () => void) => {
      let set = listeners.get(key);
      if (set === undefined) {
        set = new Set();
        listeners.set(key, set);
      }
      set.add(onChange);
      // A second tab writing the same draft should be reflected here too.
      const onStorage = (event: StorageEvent) => {
        if (event.key === key) notify(key);
      };
      window.addEventListener("storage", onStorage);
      return () => {
        set.delete(onChange);
        window.removeEventListener("storage", onStorage);
      };
    },
    [key],
  );

  /**
   * `null` on the server: there is no storage there, and claiming otherwise
   * would make the server and client markup disagree. React re-renders with the
   * real value straight after hydration, which is what this hook is for.
   */
  const stored = useSyncExternalStore(
    subscribe,
    () => (enabled ? (readDraft(key) as Partial<T> | null) : null),
    () => null,
  );

  const timer = useRef<number | undefined>(undefined);

  const save = useCallback(
    (values: T) => {
      if (!enabled) return;
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        try {
          window.localStorage.setItem(key, JSON.stringify(values));
          notify(key);
        } catch {
          // Quota or blocked storage: autosave is a convenience, not a promise.
        }
      }, DEBOUNCE_MS);
    },
    [key, enabled],
  );

  const clear = useCallback(() => {
    window.clearTimeout(timer.current);
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Nothing to clean up if it was never written.
    }
    notify(key);
  }, [key]);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  return { stored, save, clear };
}
