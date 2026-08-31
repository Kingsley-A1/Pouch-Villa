"use client";

import { useTransition } from "react";
import { revokeCodeAction } from "./actions";

type Code = {
  id: string;
  role_code: string;
  label: string | null;
  max_uses: number;
  used_count: number;
  expires_at: Date;
  revoked_at: Date | null;
};

export function CodeList({ codes }: { codes: Code[] }) {
  const [pending, start] = useTransition();
  const live = codes.filter((code) => code.revoked_at === null && code.expires_at > new Date());

  if (live.length === 0) {
    return <p className="text-sm text-(--pv-muted)">No live codes right now.</p>;
  }

  return (
    <ul className="grid gap-2">
      {live.map((code) => (
        <li
          key={code.id}
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-(--pv-line) bg-white p-3"
        >
          <div>
            <p className="text-sm font-bold">
              {code.role_code}
              {code.label ? ` · ${code.label}` : ""}
            </p>
            <p className="text-xs text-(--pv-muted)">
              {code.used_count}/{code.max_uses} used · expires{" "}
              {new Date(code.expires_at).toLocaleString("en-NG")}
            </p>
          </div>
          <button
            type="button"
            disabled={pending}
            onClick={() => start(() => revokeCodeAction(code.id))}
            className="min-h-11 text-sm font-bold text-(--pv-danger) disabled:opacity-60"
          >
            Revoke
          </button>
        </li>
      ))}
    </ul>
  );
}
