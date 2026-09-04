"use server";

import { revalidatePath } from "next/cache";
import { changeStaffPassword, updateStaffProfile } from "@pv/backend/services/staff-profile";
import { requireStaffPrincipal } from "@/server/session";
import { requestContext } from "@/server/api";
import { toActionError, type ActionState } from "@/lib/action-state";

/**
 * Editing your own staff account.
 *
 * **The staff id comes from the session and nothing else.** Neither action takes
 * one, so there is no request a caller can shape that edits somebody else's row
 * — which is why neither needs a permission beyond being signed in. §5's rule is
 * that authority is re-derived server-side on every mutation, and here the
 * authority derived is "this is your own account".
 */

/**
 * The audit context, taken from `@/server/api` rather than the session module's
 * own narrower helper, because that one carries no request id and §5 wants one
 * on every audit record.
 *
 * `ip` is spread in only when it has a value: under `exactOptionalPropertyTypes`
 * an absent key and one holding `undefined` are different types.
 */
async function auditContext() {
  const context = await requestContext();
  return {
    ...(context.ip === undefined ? {} : { ip: context.ip }),
    requestId: context.requestId,
  };
}

export async function updateStaffProfileAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const principal = await requireStaffPrincipal();

  const fullName = String(formData.get("fullName") ?? "").trim();
  if (fullName === "") return { error: "Enter your name." };
  if (fullName.length > 200) return { error: "That name is too long." };

  const phoneEntry = String(formData.get("phone") ?? "").trim();

  try {
    await updateStaffProfile(
      principal.staffId,
      { fullName, phone: phoneEntry === "" ? null : phoneEntry },
      await auditContext(),
    );
  } catch (error) {
    return toActionError(error, "Your details could not be saved.");
  }

  // The header renders the name and its monogram from the session, and the
  // sidebar is in the same layout, so the whole admin is revalidated rather
  // than this page alone.
  revalidatePath("/admin", "layout");
  return { error: null, message: "Your details are saved." };
}

export async function changeStaffPasswordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const principal = await requireStaffPrincipal();

  const currentPassword = String(formData.get("currentPassword") ?? "");
  const password = String(formData.get("password") ?? "");
  if (password === "") return { error: "Enter a new password." };

  try {
    await changeStaffPassword(
      principal.staffId,
      currentPassword === "" ? null : currentPassword,
      password,
      await auditContext(),
    );
  } catch (error) {
    return toActionError(error, "That password could not be changed.");
  }

  revalidatePath("/admin/profile");
  // Said plainly, because it is about to happen: the change revoked every
  // session including this one, so the next request lands on the login screen.
  return { error: null, message: "Password changed. Sign in again to continue." };
}
