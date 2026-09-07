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
          {/*
            `min-w-0` is what stops the whole admin scrolling sideways.

            A flex child refuses to shrink below its content by default, and an
            email address is one unbroken token — so a long one made this card
            wider than a 360 px screen and took the page with it, which §2
            forbids at any width. The wrapping below is the other half: a token
            with no space in it needs somewhere it is allowed to break.
          */}
          <div className="min-w-0">
            {/*
              A wrapping row, not a paragraph with inline pills in it.

              The badges were `<span className="ml-2">` inside the name's own
              `<p>`, so a long name with three of them after it — role,
              Suspended, Unverified — had no way to wrap cleanly and ran off the
              side. That is exactly the state a CEO sees the moment they suspend
              somebody, which is when the layout broke.
            */}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
              <span className="font-bold break-words">{member.fullName}</span>
              <Badge>{member.role}</Badge>
              {member.status === "suspended" ? <Badge tone="danger">Suspended</Badge> : null}
              {!member.emailVerified ? <Badge tone="warning">Unverified</Badge> : null}
            </div>
            <p className="mt-1 text-xs break-words text-(--pv-muted)">{member.email}</p>
            <p className="text-xs text-(--pv-muted)">
              {member.lastLoginAt
                ? `Last signed in ${new Date(member.lastLoginAt).toLocaleDateString("en-NG")}`
                : "Never signed in"}
            </p>
          </div>
          {canManage ? <AccessChange member={member} /> : null}
        </li>
      ))}
    </ul>
  );
}

/**
 * One pill, so the three of them cannot drift apart. They were three copies of
 * the same class list differing only in colour, which is how the middle one
 * ends up a different height from the other two.
 */
function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "danger" | "warning";
}) {
  const tones = {
    neutral: "bg-(--pv-wash) text-(--pv-muted)",
    danger: "bg-[color-mix(in_srgb,var(--pv-danger)_12%,var(--pv-surface))] text-(--pv-danger)",
    warning: "bg-[color-mix(in_srgb,var(--pv-warning)_12%,var(--pv-surface))] text-(--pv-warning)",
  } as const;

  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${tones[tone]}`}
    >
      {children}
    </span>
  );
}
