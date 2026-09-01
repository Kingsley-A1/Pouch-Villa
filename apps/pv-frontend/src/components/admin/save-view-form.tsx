"use client";

import { useActionState, useState } from "react";
import { Plus, Trash } from "@phosphor-icons/react";
import { INITIAL_ACTION_STATE } from "@/lib/action-state";
import { ProgressiveDisclosure } from "@/components/progressive-disclosure";
import { deleteViewAction, saveViewAction } from "@/app/admin/(protected)/saved-view-actions";

/**
 * "Save this view", and the management of the ones already saved.
 *
 * Client because the naming form is revealed on demand — a bar of shortcuts
 * should not carry a permanently open text field, and on a phone that field
 * would push the list it belongs to off the screen.
 */
export function SaveViewForm({
  screen,
  currentQuery,
  existing,
  canShare,
}: {
  screen: string;
  currentQuery: string;
  existing: { id: string; name: string }[];
  canShare: boolean;
}) {
  const [state, submit, pending] = useActionState(saveViewAction, INITIAL_ACTION_STATE);
  const [open, setOpen] = useState(false);
  const [managing, setManaging] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => setOpen((previous) => !previous)}
        aria-expanded={open}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-dashed border-(--pv-line) px-3.5 text-sm font-semibold text-(--pv-muted) hover:border-(--pv-muted)"
      >
        <Plus size={14} weight="bold" aria-hidden />
        Save this view
      </button>

      {existing.length > 0 ? (
        <button
          type="button"
          onClick={() => setManaging((previous) => !previous)}
          aria-expanded={managing}
          className="min-h-11 text-sm font-semibold text-(--pv-muted) underline"
        >
          {managing ? "Done" : "Manage"}
        </button>
      ) : null}

      <div className="w-full">
        <ProgressiveDisclosure open={open}>
          <form
            action={submit}
            className="mt-2 flex flex-wrap items-end gap-2 rounded-2xl border border-(--pv-line) bg-(--pv-surface) p-3"
          >
            <input type="hidden" name="screen" value={screen} />
            {/* What the screen is showing right now, so saving captures the
                filters actually in effect rather than asking for a description. */}
            <input type="hidden" name="query" value={currentQuery} />

            <div className="min-w-48 flex-1">
              <label className="label" htmlFor={`view-name-${screen}`}>
                Name this view
              </label>
              <input
                id={`view-name-${screen}`}
                name="name"
                className="field"
                required
                maxLength={60}
                placeholder="Receipts to check"
              />
            </div>

            {canShare ? (
              <label className="flex min-h-11 items-center gap-2 text-sm">
                <input type="checkbox" name="isShared" className="h-4 w-4 accent-(--pv-red)" />
                Share with the team
              </label>
            ) : null}

            <button
              type="submit"
              className="inline-flex min-h-11 items-center rounded-xl bg-(--pv-red) px-4 text-sm font-bold text-(--pv-on-brand) disabled:opacity-60"
              disabled={pending}
            >
              {pending ? "Saving…" : "Save"}
            </button>
          </form>
        </ProgressiveDisclosure>

        <ProgressiveDisclosure open={managing}>
          <ul className="mt-2 grid gap-1.5">
            {existing.map((view) => (
              <li
                key={view.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-(--pv-line) bg-(--pv-surface) px-3 py-2 text-sm"
              >
                <span className="font-semibold">{view.name}</span>
                <form action={deleteViewAction.bind(null, view.id, screen)}>
                  <button
                    type="submit"
                    className="grid h-11 w-11 place-items-center rounded-lg text-(--pv-danger)"
                    aria-label={`Delete the saved view ${view.name}`}
                  >
                    <Trash size={15} weight="bold" />
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </ProgressiveDisclosure>

        <p aria-live="polite" className="text-sm">
          {state.error ? <span className="text-(--pv-danger)">{state.error}</span> : null}
        </p>
      </div>
    </div>
  );
}
