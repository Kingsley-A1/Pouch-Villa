"use client";

import { useActionState } from "react";
import Link from "next/link";
import { GoogleSignInButton } from "@/components/google-sign-in-button";
import { PasswordField } from "@/components/password-field";
import { INITIAL_ACTION_STATE, type ActionState } from "@/lib/action-state";
import { registerAction, signInAction } from "./actions";

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

/**
 * What the last failed attempt was given, so the form can redraw with it.
 *
 * React resets a form once its action resolves. That is right for one that
 * succeeded and wrong for one that did not — a mistyped password used to take
 * the email address with it, so every retry began by typing an address the shop
 * had just been told. Because the reset restores each input to its
 * `defaultValue`, handing the value back through `defaultValue` is enough: the
 * reset lands on the value rather than on an empty string.
 *
 * The password is deliberately not among them. It is never sent back from the
 * server (see `keep` in `actions.ts`), so it is the one field that clears — which
 * is also the one field somebody retrying actually wants cleared.
 */
function previous(state: ActionState, name: string): string {
  return state.values?.[name] ?? "";
}

function Problem({ message }: { message: string | null }) {
  if (message === null) return null;
  return (
    <p
      role="alert"
      className="auth-note border border-[color-mix(in_srgb,var(--pv-danger)_35%,var(--pv-line))] bg-[color-mix(in_srgb,var(--pv-danger)_10%,var(--pv-surface))] px-4 py-3 text-sm text-(--pv-danger)"
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
      {/* The wrapper is what the stylesheet squares and borders — the button
          itself belongs to a shared component used on the admin too. */}
      <div className="auth-google">
        <GoogleSignInButton flow="customer" next={next} />
      </div>
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
    <div className="auth-form grid gap-5">
      {notice ? (
        <p role="status" className="auth-note bg-(--pv-wash) px-4 py-3 text-sm">
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
            defaultValue={previous(state, "email")}
            className="field"
          />
        </label>
        {/*
          A wrapping <label> would put the reveal button inside it, which is
          invalid — a label may not contain interactive content other than the
          field it labels — and makes clicking the eye also act on the input.
          `htmlFor` against the id PasswordField sets from `name` does the same
          job with none of that.
        */}
        <div className="grid gap-1.5">
          <label htmlFor="password" className="text-sm font-bold">
            Password
          </label>
          <PasswordField
            name="password"
            autoComplete="current-password"
            required
            className="field field-trailing"
          />
        </div>
        <Problem message={state.error} />
        <button className="button-primary">Sign in</button>
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
    <div className="auth-form grid gap-5">
      <GoogleBlock clientId={googleClientId} next={next} />

      <form action={formAction} className="grid gap-4">
        <input type="hidden" name="next" value={next} />
        <label className="grid gap-1.5">
          <span className="text-sm font-bold">Full name</span>
          <input
            name="fullName"
            autoComplete="name"
            defaultValue={previous(state, "fullName")}
            className="field"
          />
        </label>
        <label className="grid gap-1.5">
          <span className="text-sm font-bold">Email</span>
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            defaultValue={previous(state, "email")}
            className="field"
          />
        </label>
        <label className="grid gap-1.5">
          <span className="text-sm font-bold">
            WhatsApp number <span className="font-normal text-(--pv-muted)">(optional)</span>
          </span>
          {/*
            Optional, but worth asking for: order tracking is authorised by the
            order reference plus this number, so someone who leaves it out has a
            slower time finding an order later.
          */}
          <input
            name="phone"
            type="tel"
            autoComplete="tel"
            defaultValue={previous(state, "phone")}
            className="field"
          />
          <span className="text-xs text-(--pv-muted)">Used to look up your order later.</span>
        </label>
        <div className="grid gap-1.5">
          <label htmlFor="password" className="text-sm font-bold">
            Password
          </label>
          <PasswordField
            name="password"
            autoComplete="new-password"
            required
            aria-describedby="password-hint"
            className="field field-trailing"
          />
          <span id="password-hint" className="text-xs text-(--pv-muted)">
            {passwordHint}
          </span>
        </div>
        <Problem message={state.error} />
        <button className="button-primary">Create account</button>
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
