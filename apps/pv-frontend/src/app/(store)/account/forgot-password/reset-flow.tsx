"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { INITIAL_ACTION_STATE, type ActionState } from "@/lib/action-state";
import { completeResetAction, requestResetAction } from "../actions";

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

/**
 * Both steps of recovery on one page.
 *
 * The code arrives by email and has to be typed back in. Splitting that across
 * two pages means someone who opens the email on the same phone loses the form
 * when they switch apps and come back to a new page load. Keeping both here
 * means the address they typed is still on screen, already filled in below.
 */
export function ResetFlow({ passwordHint }: { passwordHint: string }) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  const [requestState, requestAction] = useActionState<ActionState, FormData>(
    async (prev, formData) => {
      const result = await requestResetAction(prev, formData);
      if (result.error === null) setSent(true);
      return result;
    },
    INITIAL_ACTION_STATE,
  );

  const [completeState, completeFormAction] = useActionState<ActionState, FormData>(
    completeResetAction as Action,
    INITIAL_ACTION_STATE,
  );

  return (
    <div className="grid gap-8">
      <form action={requestAction} className="grid gap-4">
        <label className="grid gap-1.5">
          <span className="text-sm font-bold">Email</span>
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="field min-h-11"
          />
        </label>
        <Problem message={requestState.error} />
        {requestState.message ? (
          <p role="status" className="rounded-xl bg-(--pv-wash) px-4 py-3 text-sm">
            {requestState.message}
          </p>
        ) : null}
        <button className="button-secondary min-h-11">
          {sent ? "Send another code" : "Send me a code"}
        </button>
      </form>

      {sent ? (
        <form action={completeFormAction} className="grid gap-4 border-t border-(--pv-line) pt-8">
          <h2 className="text-lg font-bold">Enter your code</h2>
          {/* Carried over rather than retyped — the same address, by definition. */}
          <input type="hidden" name="email" value={email} />
          <label className="grid gap-1.5">
            <span className="text-sm font-bold">6-digit code</span>
            <input
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              className="field min-h-11 tracking-[0.4em]"
            />
          </label>
          <label className="grid gap-1.5">
            <span className="text-sm font-bold">New password</span>
            <input
              name="password"
              type="password"
              autoComplete="new-password"
              required
              aria-describedby="reset-password-hint"
              className="field min-h-11"
            />
            <span id="reset-password-hint" className="text-xs text-(--pv-muted)">
              {passwordHint}
            </span>
          </label>
          <Problem message={completeState.error} />
          <button className="button-primary min-h-11">Set new password</button>
        </form>
      ) : null}

      <p className="text-sm text-(--pv-muted)">
        <Link href="/account/sign-in" className="font-bold text-(--pv-red)">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}

function Problem({ message }: { message: string | null }) {
  if (message === null) return null;
  return (
    <p
      role="alert"
      className="rounded-xl border border-[color-mix(in_srgb,var(--pv-danger)_35%,var(--pv-line))] bg-[color-mix(in_srgb,var(--pv-danger)_10%,var(--pv-surface))] px-4 py-3 text-sm text-(--pv-danger)"
    >
      {message}
    </p>
  );
}
