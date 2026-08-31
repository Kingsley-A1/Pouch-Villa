"use server";

import { redirect } from "next/navigation";
import { emailCodeSchema } from "@pv/backend/domain/schemas";
import {
  sendVerificationCode,
  verifyEmailCode,
  CodeInvalidError,
  CodeAlreadySentError,
} from "@pv/backend/services/staff-email-verification";
import { requireStaffPrincipal } from "@/server/session";
import { toActionError, type ActionState } from "@/lib/action-state";

export async function verifyCodeAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const principal = await requireStaffPrincipal();
  const parsed = emailCodeSchema.safeParse({ code: formData.get("code") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Enter the code." };

  try {
    await verifyEmailCode(principal.staffId, parsed.data.code);
  } catch (error) {
    if (error instanceof CodeInvalidError) return { error: error.message };
    return toActionError(error, "That code could not be verified.");
  }

  redirect("/admin");
}

export async function resendCodeAction(): Promise<ActionState> {
  const principal = await requireStaffPrincipal();
  try {
    await sendVerificationCode(principal.staffId, principal.email);
  } catch (error) {
    if (error instanceof CodeAlreadySentError) {
      return { error: `Wait ${error.retryAfterSeconds}s before requesting another code.` };
    }
    return toActionError(error, "The code could not be sent.");
  }
  return { error: null, message: "A new code was sent." };
}
