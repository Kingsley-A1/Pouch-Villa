"use client";

import { useActionState } from "react";
import { LockKey, WarningCircle } from "@phosphor-icons/react";
import { login } from "@/app/admin/auth-actions";

export function LoginForm() {
  const [state, action, pending] = useActionState(login, undefined);
  return (
    <form action={action} className="grid gap-5">
      {state?.error ? (
        <div role="alert" className="flex gap-2 rounded-xl bg-red-50 p-4 text-sm text-red-800">
          <WarningCircle size={20} />
          {state.error}
        </div>
      ) : null}
      <label>
        <span className="label">Email</span>
        <input className="field" type="email" name="email" autoComplete="username" required />
      </label>
      <label>
        <span className="label">Password</span>
        <input
          className="field"
          type="password"
          name="password"
          autoComplete="current-password"
          minLength={8}
          required
        />
      </label>
      <button className="button-primary" disabled={pending}>
        <LockKey size={19} /> {pending ? "Signing in…" : "Secure sign in"}
      </button>
    </form>
  );
}
