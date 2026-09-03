"use server";

import { revalidatePath } from "next/cache";
import { roleCodeMintSchema, staffStatusChangeSchema } from "@pv/backend/domain/schemas";
import { formatRoleCodeForDisplay } from "@pv/backend/auth/role-codes";
import * as staffAccess from "@pv/backend/services/staff-access";
import { sendStaffAccessChangedEmail } from "@pv/backend/services/staff-email";
import { requirePermission } from "@/server/session";
import { dispatchEmail } from "@/server/notify";
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

/**
 * Suspends or reactivates a staff member, and sends the CEO's note about it.
 *
 * Q11's answer: the message is composed here, at the moment access changes,
 * rather than being a fixed template nobody can adapt. It is optional — access
 * must never stay open because a field was blank — and `null` means the change
 * happens silently, exactly as it did before.
 *
 * The send is after the transaction commits and after authority is checked, and
 * it is not awaited: a suspension must take effect whether or not Resend is
 * reachable, and it has already ended every session by this point.
 */
export async function setStaffStatusAction(
  id: string,
  status: "active" | "suspended",
  message: string | null,
): Promise<ActionState> {
  const principal = await requirePermission("staff.manage");

  const parsed = staffStatusChangeSchema.safeParse({ status, message });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the message." };

  try {
    const changed = await staffAccess.setStaffStatus(
      id,
      parsed.data.status,
      {
        staffId: principal.staffId,
      },
      parsed.data.message,
    );

    if (changed.changed && parsed.data.message !== null) {
      dispatchEmail(
        "Staff access changed",
        sendStaffAccessChangedEmail(
          changed.email,
          changed.fullName,
          parsed.data.status,
          parsed.data.message,
        ),
      );
    }
  } catch (error) {
    return toActionError(error, "That could not be changed.");
  }
  revalidatePath("/admin/staff");
  return { error: null };
}
