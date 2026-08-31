"use client";

import { useActionState } from "react";
import {
  PERMISSIONS,
  CEO_ONLY_PERMISSIONS,
  type PermissionCode,
} from "@pv/backend/auth/permission-codes";
import type { StaffRoleCode } from "@pv/backend/auth/role-codes";
import { FormError, FormSuccess, SubmitButton } from "@/components/admin/form-controls";
import { INITIAL_ACTION_STATE } from "@/lib/action-state";
import { saveRolePermissionsAction } from "./actions";

const LABELS: Record<PermissionCode, string> = {
  "dashboard.view": "See the admin dashboard",
  "product.view": "View products and variants",
  "product.manage": "Create, edit, publish and soft-delete products",
  "category.manage": "Manage brands and categories",
  "media.manage": "Upload and remove product media",
  "order.view": "View orders and their history",
  "order.manage": "Advance order status and edit orders",
  "payment.view": "View payments and transfer proofs",
  "payment.confirm": "Confirm or reject a payment proof",
  "customer.view": "View customer accounts and purchase history",
  "customer.manage": "Suspend, restore or soft-delete a customer",
  "review.moderate": "Approve, reject and remove reviews",
  "enquiry.manage": "View and handle contact requests",
  "delivery.manage": "Manage delivery zones, fees and timeframes",
  "settings.view": "View business settings",
  "settings.manage": "Edit business settings, including bank details",
  "staff.view": "View staff accounts",
  "staff.manage": "Invite staff and manage their accounts",
  "role.manage": "Change what managers and employees may do",
  "audit.view": "Read the audit log",
};

export function RoleEditor({
  role,
  granted,
}: {
  role: Extract<StaffRoleCode, "MANAGER" | "EMPLOYEE">;
  granted: PermissionCode[];
}) {
  const [state, formAction] = useActionState(saveRolePermissionsAction, INITIAL_ACTION_STATE);
  const grantedSet = new Set(granted);

  return (
    <form
      action={formAction}
      className="grid gap-4 rounded-2xl border border-(--pv-line) bg-white p-5"
    >
      <input type="hidden" name="role" value={role} />
      <h2 className="text-lg font-bold">{role === "MANAGER" ? "Manager" : "Employee"}</h2>
      <div className="grid gap-2">
        {PERMISSIONS.map((permission) => {
          const disabled = CEO_ONLY_PERMISSIONS.includes(permission);
          return (
            <label
              key={permission}
              className={`flex min-h-11 items-start gap-3 rounded-xl px-3 py-2 ${disabled ? "opacity-50" : "hover:bg-(--pv-wash)"}`}
            >
              <input
                type="checkbox"
                name="permissions"
                value={permission}
                disabled={disabled}
                defaultChecked={grantedSet.has(permission)}
                className="mt-1 h-5 w-5 accent-(--pv-red)"
              />
              <span className="text-sm">
                {LABELS[permission]}
                {disabled ? (
                  <span className="ml-2 text-xs text-(--pv-muted)">(CEO only)</span>
                ) : null}
              </span>
            </label>
          );
        })}
      </div>
      <FormError message={state.error} />
      <FormSuccess message={state.message} />
      <SubmitButton pendingLabel="Saving…" className="justify-self-start">
        Save {role.toLowerCase()} permissions
      </SubmitButton>
    </form>
  );
}
