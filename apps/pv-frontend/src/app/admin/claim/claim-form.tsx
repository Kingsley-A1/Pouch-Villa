"use client";

import { useActionState, useState } from "react";
import { GoogleSignInButton } from "@/components/google-sign-in-button";
import { Field, FormError, SubmitButton, TextInput } from "@/components/admin/form-controls";
import { INITIAL_ACTION_STATE } from "@/lib/action-state";
import { claimWithGoogle, claimWithPassword } from "./actions";

export function ClaimForm({ googleClientId }: { googleClientId: string | null }) {
  const [state, formAction] = useActionState(claimWithPassword, INITIAL_ACTION_STATE);
  const [code, setCode] = useState("");
  const [googleError, setGoogleError] = useState<string | null>(null);

  async function handleGoogleCredential(credential: string) {
    const result = await claimWithGoogle(code, credential);
    setGoogleError(result.error);
  }

  return (
    <div className="grid gap-6">
      <form action={formAction} className="grid gap-4">
        <Field label="Role code" name="code" hint="Given to you by the CEO or a manager">
          <TextInput
            name="code"
            required
            autoComplete="off"
            autoCapitalize="characters"
            placeholder="XXXX-XXXX"
            value={code}
            onChange={(event) => setCode(event.target.value)}
          />
        </Field>
        <Field label="Full name" name="fullName">
          <TextInput name="fullName" required autoComplete="name" />
        </Field>
        <Field label="Email" name="email">
          <TextInput name="email" type="email" required autoComplete="email" />
        </Field>
        <Field label="Password" name="password" hint="At least 12 characters">
          <TextInput
            name="password"
            type="password"
            required
            minLength={12}
            autoComplete="new-password"
          />
        </Field>
        <FormError message={state.error} />
        <SubmitButton pendingLabel="Creating account…">Create account</SubmitButton>
      </form>

      {googleClientId ? (
        <>
          <div className="flex items-center gap-3 text-xs font-bold tracking-wide text-(--pv-muted) uppercase">
            <span className="h-px flex-1 bg-(--pv-line)" />
            or
            <span className="h-px flex-1 bg-(--pv-line)" />
          </div>
          <div>
            <p className="mb-2 text-sm text-(--pv-muted)">
              Enter your role code above, then continue with Google.
            </p>
            <GoogleSignInButton clientId={googleClientId} onCredential={handleGoogleCredential} />
            <FormError message={googleError} />
          </div>
        </>
      ) : null}
    </div>
  );
}
