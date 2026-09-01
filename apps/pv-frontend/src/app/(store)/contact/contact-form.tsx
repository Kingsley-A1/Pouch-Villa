"use client";

import { useActionState } from "react";
import { PaperPlaneTilt } from "@phosphor-icons/react";
import { INITIAL_ACTION_STATE } from "@/lib/action-state";
import { submitContactAction } from "./actions";

/** Client only so the result is announced in place rather than by a reload. */
export function ContactForm() {
  const [state, submit, pending] = useActionState(submitContactAction, INITIAL_ACTION_STATE);

  if (state.message) {
    return (
      <div className="card-surface mt-8 max-w-lg p-6" role="status">
        <p className="font-bold">{state.message}</p>
        <p className="help mt-1">We reply to most messages within a working day.</p>
      </div>
    );
  }

  return (
    <form action={submit} className="card-surface mt-8 grid max-w-lg gap-4 p-5">
      <div>
        <label className="label" htmlFor="name">
          Your name
        </label>
        <input
          id="name"
          name="name"
          className="field"
          required
          maxLength={200}
          autoComplete="name"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            className="field"
            maxLength={320}
            autoComplete="email"
          />
        </div>
        <div>
          <label className="label" htmlFor="phone">
            Phone
          </label>
          <input id="phone" name="phone" className="field" inputMode="tel" autoComplete="tel" />
        </div>
      </div>
      {/* One of the two is enough, and saying so up front beats a validation
          error after the fact. */}
      <p className="help -mt-2">Leave either one, so we can reply.</p>

      <div>
        <label className="label" htmlFor="orderReference">
          Order reference (optional)
        </label>
        <input
          id="orderReference"
          name="orderReference"
          className="field"
          maxLength={40}
          spellCheck={false}
        />
      </div>

      <div>
        <label className="label" htmlFor="subject">
          Subject (optional)
        </label>
        <input id="subject" name="subject" className="field" maxLength={200} />
      </div>

      <div>
        <label className="label" htmlFor="message">
          How can we help?
        </label>
        <textarea
          id="message"
          name="message"
          className="field"
          rows={5}
          required
          maxLength={4000}
        />
      </div>

      <button type="submit" className="button-primary" disabled={pending}>
        <PaperPlaneTilt size={18} weight="bold" />
        {pending ? "Sending…" : "Send message"}
      </button>

      {state.error ? (
        <p className="text-sm text-(--pv-danger)" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
