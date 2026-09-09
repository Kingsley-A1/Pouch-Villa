"use client";

import { useFormStatus } from "react-dom";
import { PasswordField } from "@/components/password-field";
import { cn } from "@/lib/utils";

export function SubmitButton({
  children,
  pendingLabel,
  variant = "primary",
  className,
  disabled = false,
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  variant?: "primary" | "ghost" | "danger";
  className?: string;
  /** Blocks submission on top of the pending state, e.g. an unmet requirement. */
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      aria-busy={pending}
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-bold disabled:opacity-60",
        variant === "primary" && "bg-(--pv-red) text-(--pv-on-brand)",
        variant === "ghost" && "border border-(--pv-line) text-(--pv-ink)",
        variant === "danger" && "bg-(--pv-danger) text-(--pv-on-brand)",
        className,
      )}
    >
      {pending ? (pendingLabel ?? "Saving…") : children}
    </button>
  );
}

export function FormError({ message }: { message: string | null | undefined }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="rounded-xl border border-(--pv-danger) bg-[color-mix(in_srgb,var(--pv-danger)_12%,var(--pv-surface))] px-4 py-3 text-sm font-semibold text-(--pv-danger)"
    >
      {message}
    </p>
  );
}

export function FormSuccess({ message }: { message: string | null | undefined }) {
  if (!message) return null;
  return (
    <p
      role="status"
      className="rounded-xl border border-(--pv-success) bg-[color-mix(in_srgb,var(--pv-success)_12%,var(--pv-surface))] px-4 py-3 text-sm font-semibold text-(--pv-success)"
    >
      {message}
    </p>
  );
}

export function Field({
  label,
  name,
  children,
  hint,
}: {
  label: string;
  name: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor={name} className="text-sm font-bold text-(--pv-ink)">
        {label}
      </label>
      {children}
      {hint ? <span className="text-xs text-(--pv-muted)">{hint}</span> : null}
    </div>
  );
}

const fieldClass =
  "min-h-11 w-full rounded-xl border border-(--pv-line) bg-(--pv-surface) px-3.5 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--pv-red)";

/*
  `id` defaults to the field's name and can be overridden, which is why it sits
  *before* the spread rather than after it.

  After the spread it was not a default but a rule, and a screen with two forms
  that share a field name — `/admin/devices` has a Brand select and a Sort order
  box in both — could not give them distinct ids. That produced duplicate ids on
  one page, and the attempt to dodge it by renaming the `<Field>` instead
  detached three labels from their controls entirely.
*/
export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input id={props.name} {...props} className={cn(fieldClass, props.className)} />;
}

/**
 * The admin's password box: the shared control, wearing admin field styling.
 *
 * The toggle behaviour lives in `components/password-field` so the storefront
 * gets the identical control rather than a second implementation of it.
 */
export function PasswordInput({
  className,
  ...props
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">) {
  return (
    <PasswordField
      {...props}
      className={cn(fieldClass, "pr-14", className)}
      toggleClassName="rounded-r-xl"
    />
  );
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      id={props.name}
      {...props}
      className={cn(fieldClass, "min-h-28 py-2.5 leading-6", props.className)}
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select id={props.name} {...props} className={cn(fieldClass, props.className)} />;
}
