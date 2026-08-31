"use client";

import { useTransition } from "react";
import { logoutAction } from "./actions";

export function LogoutButton() {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(() => logoutAction())}
      className="text-sm font-bold text-(--pv-muted) hover:text-(--pv-red) disabled:opacity-60"
    >
      {pending ? "Signing out…" : "Sign out"}
    </button>
  );
}
