"use server";

import { revalidatePath } from "next/cache";
import { PERMISSIONS } from "@pv/backend/auth/permission-codes";
import { isStaffRole } from "@pv/backend/auth/role-codes";
import { setRolePermissions } from "@pv/backend/services/roles";
import { requirePermission } from "@/server/session";
import { toActionError, type ActionState } from "@/lib/action-state";

export async function saveRolePermissionsAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const principal = await requirePermission("role.manage");

  const role = formData.get("role");
  if (typeof role !== "string" || !isStaffRole(role)) return { error: "Unknown role." };

  const granted = new Set(formData.getAll("permissions"));
  const permissions = PERMISSIONS.filter((permission) => granted.has(permission));

  try {
    await setRolePermissions(principal.staffId, role, permissions);
  } catch (error) {
    return toActionError(error, "Permissions could not be saved.");
  }
  revalidatePath("/admin/roles");
  return { error: null, message: `${role} permissions saved.` };
}
