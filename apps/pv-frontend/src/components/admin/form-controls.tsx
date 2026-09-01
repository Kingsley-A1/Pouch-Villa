"use client";

import { useFormStatus } from "react-dom";
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
        variant === "primary" && "bg-(--pv-red) text-white",
        variant === "ghost" && "border border-(--pv-line) text-(--pv-ink)",
        variant === "danger" && "bg-(--pv-danger) text-white",
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
      className="rounded-xl border border-(--pv-danger) bg-red-50 px-4 py-3 text-sm font-semibold text-(--pv-danger)"
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
      className="rounded-xl border border-(--pv-success) bg-emerald-50 px-4 py-3 text-sm font-semibold text-(--pv-success)"
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
    <label htmlFor={name} className="grid gap-1.5">
      <span className="text-sm font-bold text-(--pv-ink)">{label}</span>
      {children}
      {hint ? <span className="text-xs text-(--pv-muted)">{hint}</span> : null}
    </label>
  );
}

const fieldClass =
  "min-h-11 w-full rounded-xl border border-(--pv-line) bg-white px-3.5 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--pv-red)";

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} id={props.name} className={cn(fieldClass, props.className)} />;
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      id={props.name}
      className={cn(fieldClass, "min-h-28 py-2.5 leading-6", props.className)}
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} id={props.name} className={cn(fieldClass, props.className)} />;
}
