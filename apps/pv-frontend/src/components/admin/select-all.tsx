"use client";

import { useRef } from "react";

/**
 * "Select all", as the one genuinely interactive part of bulk selection.
 *
 * Ticking every box is the only bit the platform cannot do on its own, so it is
 * the only bit that ships JavaScript. It works on the DOM inside its own form
 * rather than holding a mirror of the selection in React state — the checkboxes
 * are already the source of truth, and a second copy could disagree with them.
 *
 * Clearing a spam-filled moderation queue is the case this exists for.
 */
export function SelectAll({ name }: { name: string }) {
  const ref = useRef<HTMLInputElement>(null);

  function setAll(checked: boolean) {
    const form = ref.current?.form;
    if (!form) return;
    for (const box of form.querySelectorAll<HTMLInputElement>(`input[name="${name}"]`)) {
      box.checked = checked;
    }
  }

  return (
    <label className="mt-4 flex min-h-11 w-fit cursor-pointer items-center gap-2 text-sm font-semibold">
      <input
        ref={ref}
        type="checkbox"
        className="h-4 w-4 accent-(--pv-red)"
        onChange={(event) => setAll(event.target.checked)}
      />
      Select all on this page
    </label>
  );
}
