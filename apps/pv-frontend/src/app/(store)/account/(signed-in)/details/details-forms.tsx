"use client";

import { useActionState } from "react";
import { INITIAL_ACTION_STATE, type ActionState } from "@/lib/action-state";
import { changePasswordAction, updateProfileAction } from "../../actions";

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

function Feedback({ state }: { state: ActionState }) {
  if (state.error !== null) {
    return (
      <p
        role="alert"
        className="rounded-xl border border-[color-mix(in_srgb,var(--pv-danger)_35%,var(--pv-line))] bg-[color-mix(in_srgb,var(--pv-danger)_10%,var(--pv-surface))] px-4 py-3 text-sm text-(--pv-danger)"
      >
        {state.error}
      </p>
    );
  }
  if (state.message) {
    return (
      <p role="status" className="rounded-xl bg-(--pv-wash) px-4 py-3 text-sm">
        {state.message}
      </p>
    );
  }
  return null;
}

export function ProfileForm({
  fullName,
  phone,
  email,
}: {
  fullName: string | null;
  phone: string | null;
  email: string;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    updateProfileAction as Action,
    INITIAL_ACTION_STATE,
  );

  return (
    <form action={formAction} className="grid gap-4">
      <label className="grid gap-1.5">
        <span className="text-sm font-bold">Full name</span>
        <input
          name="fullName"
          autoComplete="name"
          defaultValue={fullName ?? ""}
          className="field min-h-11"
        />
      </label>

      <label className="grid gap-1.5">
        <span className="text-sm font-bold">Phone</span>
        <input
          name="phone"
          type="tel"
          autoComplete="tel"
          defaultValue={phone ?? ""}
          aria-describedby="phone-hint"
          className="field min-h-11"
        />
        <span id="phone-hint" className="text-xs text-(--pv-muted)">
          Used to look up your orders, so keep it current.
        </span>
      </label>

      {/*
        Email is shown but not editable. It is the account's identity, where a
        password reset goes, and half of how an order is looked up — changing it
        needs a flow that proves control of the new address first, which is not
        this form.
      */}
      <div className="grid gap-1.5">
        <span className="text-sm font-bold">Email</span>
        <p className="field flex min-h-11 items-center break-all text-(--pv-muted)">{email}</p>
        <span className="text-xs text-(--pv-muted)">
          To change this, contact us — it is how we identify your orders.
        </span>
      </div>

      <Feedback state={state} />
      <button className="button-primary min-h-11 justify-self-start">Save details</button>
    </form>
  );
}

export function PasswordForm({
  hasPassword,
  passwordHint,
}: {
  hasPassword: boolean;
  passwordHint: string;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    changePasswordAction as Action,
    INITIAL_ACTION_STATE,
  );

  return (
    <form action={formAction} className="grid gap-4">
      {/*
        An account created through Google has no current password to confirm, so
        this becomes "set one" — which is how someone who signed up with Google
        adds an email and password way in.
      */}
      {hasPassword ? (
        <label className="grid gap-1.5">
          <span className="text-sm font-bold">Current password</span>
          <input
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            required
            className="field min-h-11"
          />
        </label>
      ) : null}

      <label className="grid gap-1.5">
        <span className="text-sm font-bold">{hasPassword ? "New password" : "Password"}</span>
        <input
          name="password"
          type="password"
          autoComplete="new-password"
          required
          aria-describedby="new-password-hint"
          className="field min-h-11"
        />
        <span id="new-password-hint" className="text-xs text-(--pv-muted)">
          {passwordHint}
        </span>
      </label>

      <p className="text-xs text-(--pv-muted)">
        Changing this signs you out everywhere, including here.
      </p>

      <Feedback state={state} />
      <button className="button-primary min-h-11 justify-self-start">
        {hasPassword ? "Change password" : "Set password"}
      </button>
    </form>
  );
}
