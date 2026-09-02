"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Moves the new member on to their account after a beat.
 *
 * The screen has to be readable before it disappears, and it has to disappear —
 * a confirmation with no exit is a dead end. The pause is long enough to read
 * one short sentence and no longer.
 *
 * `replace`, not `push`: the welcome is a moment, not a place, and leaving it in
 * history would send someone who taps Back to a confirmation of something that
 * already happened.
 *
 * The visible link beside this is the real control. Nothing here is required for
 * the page to work — with the JavaScript still in flight on a slow connection,
 * the member taps through themselves.
 */
const PAUSE_MS = 2600;

export function ContinueToAccount({ href }: { href: string }) {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => router.replace(href), PAUSE_MS);
    return () => clearTimeout(timer);
  }, [href, router]);

  return null;
}
