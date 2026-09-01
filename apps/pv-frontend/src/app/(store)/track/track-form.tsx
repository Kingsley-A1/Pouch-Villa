"use client";

import { useActionState } from "react";
import { MagnifyingGlass } from "@phosphor-icons/react";
import { INITIAL_ACTION_STATE } from "@/lib/action-state";
import { trackOrderAction } from "./actions";

/** Client only so the pending state and the error can be announced without a reload. */
export function TrackForm({ defaultReference }: { defaultReference: string }) {
  const [state, submit, pending] = useActionState(trackOrderAction, INITIAL_ACTION_STATE);

  return (
    <form action={submit} className="card-surface mt-8 grid max-w-lg gap-4 p-5">
      <div>
        <label className="label" htmlFor="reference">
          Order reference
        </label>
        <input
          id="reference"
          name="reference"
          className="field"
          required
          maxLength={40}
          defaultValue={defaultReference}
          autoComplete="off"
          spellCheck={false}
          aria-describedby="reference-help"
        />
        <p className="help mt-1" id="reference-help">
          It looks like PV-XXXXX-XXXXX and is on your confirmation email.
        </p>
      </div>

      <div>
        <label className="label" htmlFor="phone">
          Phone number on the order
        </label>
        <input
          id="phone"
          name="phone"
          className="field"
          required
          inputMode="tel"
          autoComplete="tel"
        />
      </div>

      <button type="submit" className="button-primary" disabled={pending}>
        <MagnifyingGlass size={18} weight="bold" />
        {pending ? "Looking…" : "Find my order"}
      </button>

      {state.error ? (
        <p className="text-sm text-(--pv-danger)" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
