"use server";

import { revalidatePath } from "next/cache";
import {
  deleteSavedView,
  isViewScreen,
  saveView,
  type ViewScreen,
} from "@pv/backend/services/saved-views";
import { toActionError, type ActionState } from "@/lib/action-state";
import { requireStaffPrincipal } from "@/server/session";

/**
 * Saved views belong to the person, not to a permission.
 *
 * There is deliberately no `requirePermission` here beyond being signed-in
 * staff: a view is a bookmark, and it grants nothing. Following one lands on a
 * screen that does its own permission check, so a shortcut to a page you may not
 * open is simply a shortcut to a redirect.
 *
 * The one thing that is checked is ownership — `deleteSavedView` will only
 * remove a row whose `staff_id` matches, so one person cannot delete a shortcut
 * the rest of the shop is using.
 */

function screenFrom(formData: FormData): ViewScreen | null {
  const value = formData.get("screen");
  return typeof value === "string" && isViewScreen(value) ? value : null;
}

export async function saveViewAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const principal = await requireStaffPrincipal();

  const screen = screenFrom(formData);
  const name = formData.get("name");
  const queryString = formData.get("query");

  if (screen === null || typeof name !== "string" || name.trim() === "") {
    return { error: "Give this view a name." };
  }

  try {
    await saveView(
      {
        screen,
        name: name.trim().slice(0, 60),
        query: typeof queryString === "string" ? queryString : "",
        isShared: formData.get("isShared") === "on",
      },
      { staffId: principal.staffId },
    );
  } catch (error) {
    return toActionError(error, "That view could not be saved.");
  }

  revalidatePath(`/admin/${screen}`);
  return { error: null, message: "Saved." };
}

export async function deleteViewAction(viewId: string, screen: string): Promise<void> {
  const principal = await requireStaffPrincipal();
  await deleteSavedView(viewId, { staffId: principal.staffId });
  if (isViewScreen(screen)) revalidatePath(`/admin/${screen}`);
}
