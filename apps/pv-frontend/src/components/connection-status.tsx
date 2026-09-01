"use client";

import { useEffect, useState } from "react";

/**
 * A standing banner for a connection that is offline or barely usable.
 *
 * This exists because the design target is a mid-range Android phone on
 * Nigerian mobile data (AGENTS.md §2). On that connection a request does not
 * fail cleanly — it hangs, and the page looks broken rather than slow. Saying
 * so plainly is the difference between a customer waiting and a customer
 * leaving.
 *
 * `navigator.connection` is Chromium-only, which covers most of the target
 * audience; where it is missing we simply never show the slow-connection state
 * rather than guessing from timings.
 */

type ConnectionInfo = {
  effectiveType?: string;
  saveData?: boolean;
  addEventListener?: (type: "change", listener: () => void) => void;
  removeEventListener?: (type: "change", listener: () => void) => void;
};

function connection(): ConnectionInfo | undefined {
  return (navigator as Navigator & { connection?: ConnectionInfo }).connection;
}

const SLOW_TYPES = new Set(["slow-2g", "2g"]);

export function ConnectionStatus() {
  const [offline, setOffline] = useState(false);
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const syncOnline = () => setOffline(!navigator.onLine);
    const syncSpeed = () => {
      const info = connection();
      setSlow(info?.effectiveType !== undefined && SLOW_TYPES.has(info.effectiveType));
    };

    syncOnline();
    syncSpeed();
    window.addEventListener("online", syncOnline);
    window.addEventListener("offline", syncOnline);
    const info = connection();
    info?.addEventListener?.("change", syncSpeed);

    return () => {
      window.removeEventListener("online", syncOnline);
      window.removeEventListener("offline", syncOnline);
      info?.removeEventListener?.("change", syncSpeed);
    };
  }, []);

  if (!offline && !slow) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`px-4 py-2 text-center text-sm font-semibold ${
        offline
          ? "bg-(--pv-danger) text-(--pv-on-brand)"
          : "bg-[color-mix(in_srgb,var(--pv-warning)_18%,var(--pv-surface))] text-(--pv-warning)"
      }`}
    >
      {offline ? (
        <>You are offline. Nothing you do here will be saved until the connection returns.</>
      ) : (
        <>Your connection is slow. Pages may take longer than usual to load.</>
      )}
    </div>
  );
}
