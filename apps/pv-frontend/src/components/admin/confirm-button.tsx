"use client";

import { useState, useTransition } from "react";

/**
 * A two-step confirmation reachable with one thumb: the first tap reveals a
 * Confirm / Cancel pair in place, rather than a native `confirm()` dialog, which
 * is easy to mis-tap on a small screen and blocks the render thread.
 */
export function ConfirmButton({
  label,
  confirmLabel = "Confirm",
  onConfirm,
  className = "text-sm font-bold text-(--pv-danger)",
}: {
  label: string;
  confirmLabel?: string;
  onConfirm: () => Promise<void>;
  className?: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();

  if (!confirming) {
    return (
      <button type="button" onClick={() => setConfirming(true)} className={className}>
        {label}
      </button>
    );
  }

  return (
    <span className="inline-flex min-h-11 items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            await onConfirm();
            setConfirming(false);
          })
        }
        className="min-h-11 rounded-lg bg-(--pv-danger) px-3 text-sm font-bold text-(--pv-on-brand) disabled:opacity-60"
      >
        {pending ? "Working…" : confirmLabel}
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => setConfirming(false)}
        className="min-h-11 rounded-lg border border-(--pv-line) px-3 text-sm font-semibold"
      >
        Cancel
      </button>
    </span>
  );
}
