"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

/**
 * The shared error boundary body.
 *
 * Three things it deliberately does, which the placeholder it replaces did not:
 *
 * 1. **Distinguishes offline from broken.** On mobile data the overwhelmingly
 *    likely cause is a dropped connection, and telling someone their connection
 *    failed — when it did — is both true and actionable. Calling that a server
 *    error sends them away for no reason.
 * 2. **Retries with backoff, and says so.** `reset()` re-runs the failed render.
 *    Hammering it on a flaky connection just fails faster, so repeated attempts
 *    space out and the button says what it is doing.
 * 3. **Shows the digest.** Next replaces the real message with an opaque digest
 *    in production; surfacing it is what makes a support conversation possible.
 *    It is an error id, not error content — no stack, no message, nothing from
 *    the server. AGENTS.md §5 forbids leaking the latter, not the former.
 */
export function ErrorState({
  error,
  reset,
  title = "This page could not load.",
  homeHref = "/",
  homeLabel = "Go to the home page",
}: {
  error: Error & { digest?: string };
  reset: () => void;
  title?: string;
  homeHref?: string;
  homeLabel?: string;
}) {
  const [attempts, setAttempts] = useState(0);
  const [waiting, setWaiting] = useState(false);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const sync = () => setOffline(!navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  useEffect(() => {
    // The boundary is the last place an error can be seen, so it is the right
    // place to record one. Server-side causes are already logged server-side.
    console.error("Route error boundary", error.digest ?? error.message);
  }, [error]);

  function retry() {
    // 0s, 1s, 2s, 4s, capped — enough to outlast a brief mobile-data drop
    // without making someone wait through an exponential curve.
    const delay = attempts === 0 ? 0 : Math.min(2 ** (attempts - 1), 4) * 1000;
    setAttempts((count) => count + 1);
    if (delay === 0) {
      reset();
      return;
    }
    setWaiting(true);
    window.setTimeout(() => {
      setWaiting(false);
      reset();
    }, delay);
  }

  return (
    <section className="section-space">
      <div className="container-shell">
        <div className="mx-auto max-w-xl rounded-3xl border border-(--pv-line) bg-(--pv-surface) p-8 text-center">
          <p className="eyebrow">{offline ? "No connection" : "Something went wrong"}</p>
          <h1 className="mt-3 text-2xl font-bold">
            {offline ? "You appear to be offline." : title}
          </h1>
          <p className="mt-3 text-(--pv-muted)">
            {offline
              ? "Check your mobile data or Wi-Fi, then try again. Nothing you were doing has been lost."
              : "Nothing was saved or charged. You can try again, and if it keeps happening the reference below will help us find it."}
          </p>

          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button type="button" className="button-primary" onClick={retry} disabled={waiting}>
              {waiting ? "Retrying…" : attempts === 0 ? "Try again" : "Try again"}
            </button>
            <Link href={homeHref} className="button-secondary">
              {homeLabel}
            </Link>
          </div>

          {attempts >= 2 && !offline ? (
            <p className="mt-4 text-sm text-(--pv-muted)">
              Still failing after {attempts} attempts. It is likely a problem on our side rather
              than yours.
            </p>
          ) : null}

          {error.digest ? (
            <p className="mt-6 border-t border-(--pv-line) pt-4 font-mono text-xs text-(--pv-muted)">
              Reference {error.digest}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
