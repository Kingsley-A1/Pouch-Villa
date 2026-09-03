"use client";

import { useActionState } from "react";
import { GoogleSignInButton } from "@/components/google-sign-in-button";
import {
  Field,
  FormError,
  PasswordInput,
  SubmitButton,
  TextInput,
} from "@/components/admin/form-controls";
import { INITIAL_ACTION_STATE } from "@/lib/action-state";
import { loginAction } from "./actions";

/**
 * `googleError` is gone with the SDK. A redirect flow reports its outcome by
 * coming back to this page with a `?google=` reason, which the page reads and
 * renders — there is no in-page callback left to catch an error from.
 */
export function LoginForm({ googleClientId }: { googleClientId: string | null }) {
  const [state, formAction] = useActionState(loginAction, INITIAL_ACTION_STATE);

  return (
    <div className="grid gap-6">
      <form action={formAction} className="panel-bracket grid gap-4 p-5">
        <Field label="Email" name="email">
          <TextInput name="email" type="email" required autoComplete="email" />
        </Field>
        <Field label="Password" name="password">
          <PasswordInput name="password" required autoComplete="current-password" />
        </Field>
        <FormError message={state.error} />
        <SubmitButton pendingLabel="Signing in…">Sign in</SubmitButton>
      </form>

      {googleClientId ? (
        <>
          <div className="flex items-center gap-3 text-xs font-bold tracking-wide text-(--pv-muted) uppercase">
            <span className="h-px flex-1 bg-(--pv-line)" />
            or
            <span className="h-px flex-1 bg-(--pv-line)" />
          </div>
          <GoogleSignInButton flow="staff" />
        </>
      ) : null}
    </div>
  );
}
