"use server";

import { redirect } from "next/navigation";
import { staffLoginSchema } from "@pv/backend/domain/schemas";
import {
  loginWithPassword,
  InvalidCredentialsError,
  TooManyAttemptsError,
  AccountSuspendedError,
} from "@pv/backend/services/staff-login";
import { createStaffSession, currentRequestContext } from "@/server/session";
import { toActionError, type ActionState } from "@/lib/action-state";

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = staffLoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  }

  const context = await currentRequestContext();
  let staffId: string;
  try {
    ({ staffId } = await loginWithPassword(parsed.data.email, parsed.data.password, context));
  } catch (error) {
    if (
      error instanceof InvalidCredentialsError ||
      error instanceof TooManyAttemptsError ||
      error instanceof AccountSuspendedError
    ) {
      return { error: error.message };
    }
    return toActionError(error, "Sign-in could not be completed.");
  }

  await createStaffSession(staffId);
  redirect("/admin");
}
