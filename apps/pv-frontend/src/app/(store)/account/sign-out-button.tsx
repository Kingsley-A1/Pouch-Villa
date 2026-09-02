"use client";

import { useTransition } from "react";
import { signOutAction } from "./actions";

/**
 * A form-free button, because signing out is a mutation and must not be a link:
 * a `GET` that ends a session can be triggered by any image tag on any page.
 */
export function SignOutButton() {
  const [pending, start] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(() => signOutAction())}
      className="button-secondary min-h-11"
    >
      {pending ? "Signing out…" : "Sign out"}
    </button>
  );
}
