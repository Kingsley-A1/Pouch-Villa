"use client";

import { useActionState, useState, useTransition } from "react";
import {
  Field,
  FormError,
  FormSuccess,
  SubmitButton,
  TextInput,
} from "@/components/admin/form-controls";
import { INITIAL_ACTION_STATE } from "@/lib/action-state";
import { resendCodeAction, verifyCodeAction } from "./actions";

export function VerifyEmailForm() {
  const [state, formAction] = useActionState(verifyCodeAction, INITIAL_ACTION_STATE);
  const [resendState, setResendState] = useState(INITIAL_ACTION_STATE);
  const [isResending, startResend] = useTransition();

  return (
    <div className="grid gap-6">
      <form action={formAction} className="panel-bracket grid gap-4 p-5">
        <Field label="6-digit code" name="code">
          <TextInput
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{6}"
            maxLength={6}
            required
            className="text-center text-2xl tracking-[0.4em]"
          />
        </Field>
        <FormError message={state.error} />
        <SubmitButton pendingLabel="Verifying…">Verify</SubmitButton>
      </form>

      <div>
        <button
          type="button"
          disabled={isResending}
          onClick={() =>
            startResend(async () => {
              setResendState(await resendCodeAction());
            })
          }
          className="text-sm font-bold text-(--pv-red) disabled:opacity-60"
        >
          {isResending ? "Sending…" : "Resend code"}
        </button>
        <div className="mt-2">
          <FormError message={resendState.error} />
          <FormSuccess message={resendState.message} />
        </div>
      </div>
    </div>
  );
}
