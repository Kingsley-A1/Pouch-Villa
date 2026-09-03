"use client";

import type { AdminStaffMember } from "@pv/backend/services/staff-access";
import { AccessChange } from "./access-change";

export function StaffList({
  members,
  canManage,
}: {
  members: AdminStaffMember[];
  canManage: boolean;
}) {
  return (
    <ul className="grid gap-3">
      {members.map((member) => (
        <li
          key={member.id}
          className="grid gap-3 rounded-2xl border border-(--pv-line) bg-(--pv-surface) p-4 sm:flex sm:items-start sm:justify-between sm:gap-6"
        >
          <div>
            <p className="font-bold">
              {member.fullName}
              <span className="ml-2 rounded-full bg-(--pv-wash) px-2 py-0.5 text-xs font-semibold text-(--pv-muted)">
                {member.role}
              </span>
              {member.status === "suspended" ? (
                <span className="ml-2 rounded-full bg-[color-mix(in_srgb,var(--pv-danger)_12%,var(--pv-surface))] px-2 py-0.5 text-xs font-semibold text-(--pv-danger)">
                  Suspended
                </span>
              ) : null}
              {!member.emailVerified ? (
                <span className="ml-2 rounded-full bg-[color-mix(in_srgb,var(--pv-warning)_12%,var(--pv-surface))] px-2 py-0.5 text-xs font-semibold text-(--pv-warning)">
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
          {canManage ? <AccessChange member={member} /> : null}
        </li>
      ))}
    </ul>
  );
}
