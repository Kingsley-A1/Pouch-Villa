"use client";

import { useTransition } from "react";
import type { AdminStaffMember } from "@pv/backend/services/staff-access";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { setStaffStatusAction } from "./actions";

export function StaffList({
  members,
  canManage,
}: {
  members: AdminStaffMember[];
  canManage: boolean;
}) {
  const [pending, start] = useTransition();

  return (
    <ul className="grid gap-3">
      {members.map((member) => (
        <li
          key={member.id}
          className="grid gap-2 rounded-2xl border border-(--pv-line) bg-white p-4 sm:flex sm:items-center sm:justify-between"
        >
          <div>
            <p className="font-bold">
              {member.fullName}
              <span className="ml-2 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-(--pv-muted)">
                {member.role}
              </span>
              {member.status === "suspended" ? (
                <span className="ml-2 rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-(--pv-danger)">
                  Suspended
                </span>
              ) : null}
              {!member.emailVerified ? (
                <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800">
                  Unverified
                </span>
              ) : null}
            </p>
            <p className="text-xs text-(--pv-muted)">
              {member.email}
              {member.lastLoginAt
                ? ` · last signed in ${new Date(member.lastLoginAt).toLocaleDateString("en-NG")}`
                : " · never signed in"}
            </p>
          </div>
          {canManage ? (
            member.status === "active" ? (
              <ConfirmButton
                label="Suspend"
                confirmLabel="Suspend"
                onConfirm={async () => {
                  await setStaffStatusAction(member.id, "suspended");
                }}
              />
            ) : (
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    await setStaffStatusAction(member.id, "active");
                  })
                }
                className="min-h-11 text-sm font-bold text-(--pv-success) disabled:opacity-60"
              >
                Reactivate
              </button>
            )
          ) : null}
        </li>
      ))}
    </ul>
  );
}
