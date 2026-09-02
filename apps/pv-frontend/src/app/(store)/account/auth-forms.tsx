"use client";

import { useActionState } from "react";
import Link from "next/link";
import { GoogleSignInButton } from "@/components/google-sign-in-button";
import { INITIAL_ACTION_STATE, type ActionState } from "@/lib/action-state";
import { googleSignInAction, registerAction, signInAction } from "./actions";

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

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

/**
 * Google sits above the password fields on both forms, and the two are separated
 * by a labelled rule rather than left to read as one long form. Most people
 * arriving here already have a Google account on the phone in their hand; asking
 * them to invent and remember a twelve-character password first is the step that
 * loses the sale.
 */
function GoogleBlock({ clientId, next }: { clientId: string | null; next: string }) {
  if (clientId === null) return null;
  return (
    <>
      <GoogleSignInButton
        clientId={clientId}
        onCredential={async (credential) => {
          await googleSignInAction(credential, next);
        }}
      />
      <p className="flex items-center gap-3 text-xs font-bold tracking-wider text-(--pv-muted) uppercase">
        <span className="h-px flex-1 bg-(--pv-line)" />
        or
        <span className="h-px flex-1 bg-(--pv-line)" />
      </p>
    </>
  );
}

export function SignInForm({
  googleClientId,
  next,
  notice,
}: {
  googleClientId: string | null;
  next: string;
  notice: string | null;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    signInAction as Action,
    INITIAL_ACTION_STATE,
  );

  return (
    <div className="grid gap-5">
      {notice ? (
        <p role="status" className="rounded-xl bg-(--pv-wash) px-4 py-3 text-sm">
          {notice}
        </p>
      ) : null}

      <GoogleBlock clientId={googleClientId} next={next} />

      <form action={formAction} className="grid gap-4">
        <input type="hidden" name="next" value={next} />
        <label className="grid gap-1.5">
          <span className="text-sm font-bold">Email</span>
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            className="field min-h-11"
          />
        </label>
        <label className="grid gap-1.5">
          <span className="text-sm font-bold">Password</span>
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="field min-h-11"
          />
        </label>
        <Problem message={state.error} />
        <button className="button-primary min-h-11">Sign in</button>
      </form>

      <p className="text-sm text-(--pv-muted)">
        <Link href="/account/forgot-password" className="font-bold text-(--pv-red)">
          Forgotten your password?
        </Link>
      </p>
      <p className="text-sm text-(--pv-muted)">
        New here?{" "}
        <Link
          href={`/account/register?next=${encodeURIComponent(next)}`}
          className="font-bold text-(--pv-red)"
        >
          Create an account
        </Link>
      </p>
    </div>
  );
}

export function RegisterForm({
  googleClientId,
  next,
  passwordHint,
}: {
  googleClientId: string | null;
  next: string;
  passwordHint: string;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    registerAction as Action,
    INITIAL_ACTION_STATE,
  );

  return (
    <div className="grid gap-5">
      <GoogleBlock clientId={googleClientId} next={next} />

      <form action={formAction} className="grid gap-4">
        <input type="hidden" name="next" value={next} />
        <label className="grid gap-1.5">
          <span className="text-sm font-bold">Full name</span>
          <input name="fullName" autoComplete="name" className="field min-h-11" />
        </label>
        <label className="grid gap-1.5">
          <span className="text-sm font-bold">Email</span>
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            className="field min-h-11"
          />
        </label>
        <label className="grid gap-1.5">
          <span className="text-sm font-bold">
            Phone <span className="font-normal text-(--pv-muted)">(optional)</span>
          </span>
          {/*
            Optional, but worth asking for: order tracking is authorised by the
            order reference plus this number, so someone who leaves it out has a
            slower time finding an order later.
          */}
          <input name="phone" type="tel" autoComplete="tel" className="field min-h-11" />
          <span className="text-xs text-(--pv-muted)">Used to look up your order later.</span>
        </label>
        <label className="grid gap-1.5">
          <span className="text-sm font-bold">Password</span>
          <input
            name="password"
            type="password"
            autoComplete="new-password"
            required
            aria-describedby="password-hint"
            className="field min-h-11"
          />
          <span id="password-hint" className="text-xs text-(--pv-muted)">
            {passwordHint}
          </span>
        </label>
        <Problem message={state.error} />
        <button className="button-primary min-h-11">Create account</button>
      </form>

      <p className="text-sm text-(--pv-muted)">
        Already have an account?{" "}
        <Link
          href={`/account/sign-in?next=${encodeURIComponent(next)}`}
          className="font-bold text-(--pv-red)"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
