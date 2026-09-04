"use client";

import { useActionState } from "react";
import {
  Field,
  FormError,
  FormSuccess,
  PasswordInput,
  SubmitButton,
  TextInput,
} from "@/components/admin/form-controls";
import { INITIAL_ACTION_STATE, type ActionState } from "@/lib/action-state";
import { changeStaffPasswordAction, updateStaffProfileAction } from "./actions";

/**
 * The staff equivalent of the customer's "Your details" forms, built from the
 * admin's own controls rather than the storefront's — the two identity stacks
 * share no code path (§5), and that includes the screens.
 */

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

export function StaffProfileForm({
  fullName,
  phone,
  email,
  role,
}: {
  fullName: string;
  phone: string | null;
  email: string;
  role: string;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    updateStaffProfileAction as Action,
    INITIAL_ACTION_STATE,
  );

  return (
    <form action={formAction} className="panel-bracket grid gap-5 p-5">
      <Field label="Full name" name="fullName" hint="Shown on the audit trail beside what you do.">
        <TextInput
          name="fullName"
          required
          maxLength={200}
          autoComplete="name"
          defaultValue={fullName}
        />
      </Field>

      <Field
        label="Phone"
        name="phone"
        hint="Optional. So the rest of the team can reach you about an order."
      >
        <TextInput name="phone" type="tel" autoComplete="tel" defaultValue={phone ?? ""} />
      </Field>

      {/*
        Email and role are shown and not editable, and for different reasons.
        Email is the account's identity and where a verification lands, so
        changing it needs a flow that proves control of the new address. Role is
        a privilege: raising your own is the whole attack ADR 0002 is written
        against, so it changes only by redeeming a code or by a CEO's act.
      */}
      <div className="grid gap-4 sm:grid-cols-2">
        <ReadOnlyFact
          label="Email"
          value={email}
          note="To change this, ask someone with staff access."
        />
        <ReadOnlyFact
          label="Access level"
          value={role}
          note="Only a CEO can change what someone may do."
        />
      </div>

      <FormError message={state.error} />
      <FormSuccess message={state.message} />

      <SubmitButton className="justify-self-start" pendingLabel="Saving…">
        Save details
      </SubmitButton>
    </form>
  );
}

function ReadOnlyFact({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="grid gap-1.5">
      <span className="text-sm font-bold text-(--pv-ink)">{label}</span>
      <p className="field flex min-h-11 items-center break-all text-(--pv-muted)">{value}</p>
      <span className="text-xs text-(--pv-muted)">{note}</span>
    </div>
  );
}

export function StaffPasswordForm({
  hasPassword,
  passwordHint,
}: {
  hasPassword: boolean;
  passwordHint: string;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    changeStaffPasswordAction as Action,
    INITIAL_ACTION_STATE,
  );

  return (
    <form action={formAction} className="panel-bracket grid gap-5 p-5">
      {/*
        An account that only ever signed in with Google has no current password
        to confirm, so this sets one instead — which is what gives a staff member
        a second way in on a morning when Google is unreachable.
      */}
      {hasPassword ? (
        <Field label="Current password" name="currentPassword">
          <PasswordInput name="currentPassword" required autoComplete="current-password" />
        </Field>
      ) : null}

      <Field label={hasPassword ? "New password" : "Password"} name="password" hint={passwordHint}>
        <PasswordInput name="password" required autoComplete="new-password" />
      </Field>

      <p className="text-xs text-(--pv-muted)">
        Changing this signs you out on every device, including this one.
      </p>

      <FormError message={state.error} />
      <FormSuccess message={state.message} />

      <SubmitButton className="justify-self-start" pendingLabel="Saving…">
        {hasPassword ? "Change password" : "Set password"}
      </SubmitButton>
    </form>
  );
}
