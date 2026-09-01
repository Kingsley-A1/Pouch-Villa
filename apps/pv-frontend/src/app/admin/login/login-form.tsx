"use client";

import { useActionState, useState } from "react";
import { GoogleSignInButton } from "@/components/google-sign-in-button";
import { Field, FormError, SubmitButton, TextInput } from "@/components/admin/form-controls";
import { INITIAL_ACTION_STATE } from "@/lib/action-state";
import { loginAction, loginWithGoogleAction } from "./actions";

export function LoginForm({ googleClientId }: { googleClientId: string | null }) {
  const [state, formAction] = useActionState(loginAction, INITIAL_ACTION_STATE);
  const [googleError, setGoogleError] = useState<string | null>(null);

  async function handleGoogleCredential(credential: string) {
    const result = await loginWithGoogleAction(credential);
    setGoogleError(result.error);
  }

  return (
    <div className="grid gap-6">
      <form action={formAction} className="panel-bracket grid gap-4 p-5">
        <Field label="Email" name="email">
          <TextInput name="email" type="email" required autoComplete="email" />
        </Field>
        <Field label="Password" name="password">
          <TextInput name="password" type="password" required autoComplete="current-password" />
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
          <div>
            <GoogleSignInButton clientId={googleClientId} onCredential={handleGoogleCredential} />
            <FormError message={googleError} />
          </div>
        </>
      ) : null}
    </div>
  );
}
