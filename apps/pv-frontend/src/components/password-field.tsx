"use client";

import { useState } from "react";
import { Eye, EyeSlash } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

/**
 * A password box with a reveal toggle, for both sides of the app.
 *
 * It lived in the admin's form controls and nowhere else, so the storefront —
 * where the people typing on phones actually are — had no way to check what they
 * had typed. A second copy would have been the easy fix and the wrong one: this
 * is the control most likely to grow a rule later (a caps-lock warning, a
 * strength meter), and two copies is how one of them quietly stops matching.
 *
 * The styling of the box itself is the caller's, passed in — the two surfaces
 * genuinely look different, and that difference is not worth a prop each for
 * border, radius and ground. **That includes the room the toggle needs.** The
 * admin's field is built from Tailwind utilities, where a `pr-*` wins; the
 * storefront's `.field` sets `padding` with an unlayered shorthand that beats
 * every utility, so it needs `.field-trailing` instead. A hardcoded `pr-14` here
 * silently does nothing on one of the two, and the password runs under the eye.
 *
 * **It is a `<button type="button">`, deliberately.** Inside a form, a button
 * with no explicit type is a submit button, so revealing your password would
 * post the form — and on a sign-in form that means a failed attempt against the
 * rate limiter every time somebody checks their own typing.
 */
export function PasswordField({
  className,
  toggleClassName,
  ...props
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> & { toggleClassName?: string }) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        {...props}
        id={props.name}
        type={visible ? "text" : "password"}
        className={cn(className)}
      />
      <button
        type="button"
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        onClick={() => setVisible((current) => !current)}
        className={cn(
          "absolute inset-y-0 right-0 flex min-h-11 min-w-11 items-center justify-center",
          "text-(--pv-muted) hover:text-(--pv-ink)",
          "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-(--pv-focus)",
          toggleClassName,
        )}
      >
        {visible ? (
          <EyeSlash aria-hidden="true" size={20} weight="bold" />
        ) : (
          <Eye aria-hidden="true" size={20} weight="bold" />
        )}
      </button>
    </div>
  );
}
