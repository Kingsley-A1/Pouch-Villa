"use server";

import { redirect } from "next/navigation";
import { claimRoleCodeSchema } from "@pv/backend/domain/schemas";
import {
  redeemRoleCode,
  EmailAlreadyRegisteredError,
  RoleCodeRejectedError,
} from "@pv/backend/services/staff-access";
import { sendVerificationCode } from "@pv/backend/services/staff-email-verification";
import { createStaffSession, currentRequestContext } from "@/server/session";
import { toActionError, type ActionState } from "@/lib/action-state";

const GENERIC_CODE_ERROR =
  "That code could not be used. It may be wrong, expired, already used, or revoked.";

export async function claimWithPassword(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = claimRoleCodeSchema.safeParse({
    code: formData.get("code"),
    email: formData.get("email"),
    fullName: formData.get("fullName"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  }

  const context = await currentRequestContext();
  try {
    const { staffId } = await redeemRoleCode(parsed.data, context);

    await createStaffSession(staffId);
    await sendVerificationCode(staffId, parsed.data.email).catch(() => {
      // Claiming the account must not fail just because the verification email
      // did not send — the person can request a fresh code from that screen.
    });
  } catch (error) {
    if (error instanceof RoleCodeRejectedError) return { error: GENERIC_CODE_ERROR };
    if (error instanceof EmailAlreadyRegisteredError) return { error: error.message };
    return toActionError(error, "That account could not be created.");
  }

  redirect("/admin/verify-email");
}
