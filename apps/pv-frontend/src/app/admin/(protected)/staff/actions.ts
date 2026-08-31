"use server";

import { revalidatePath } from "next/cache";
import { roleCodeMintSchema } from "@pv/backend/domain/schemas";
import { formatRoleCodeForDisplay } from "@pv/backend/auth/role-codes";
import * as staffAccess from "@pv/backend/services/staff-access";
import { requirePermission } from "@/server/session";
import { toActionError, type ActionState } from "@/lib/action-state";

export type MintCodeState = ActionState & { code?: string };

export async function mintCodeAction(
  _prev: MintCodeState,
  formData: FormData,
): Promise<MintCodeState> {
  const principal = await requirePermission("staff.manage");
  const parsed = roleCodeMintSchema.safeParse({
    role: formData.get("role"),
    label: formData.get("label") || undefined,
    maxUses: formData.get("maxUses") || 1,
    ttlMinutes: formData.get("ttlMinutes") || 60 * 24 * 7,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };

  const { label, ...rest } = parsed.data;
  try {
    const minted = await staffAccess.mintRoleCode(
      { ...rest, ...(label ? { label } : {}) },
      { staffId: principal.staffId },
    );
    revalidatePath("/admin/staff");
    return { error: null, code: formatRoleCodeForDisplay(minted.code) };
  } catch (error) {
    return toActionError(error, "The code could not be created.");
  }
}

export async function revokeCodeAction(id: string) {
  const principal = await requirePermission("staff.manage");
  await staffAccess.revokeRoleCode(id, { staffId: principal.staffId });
  revalidatePath("/admin/staff");
}

export async function setStaffStatusAction(
  id: string,
  status: "active" | "suspended",
): Promise<ActionState> {
  const principal = await requirePermission("staff.manage");
  try {
    await staffAccess.setStaffStatus(id, status, { staffId: principal.staffId });
  } catch (error) {
    return toActionError(error, "That could not be changed.");
  }
  revalidatePath("/admin/staff");
  return { error: null };
}
