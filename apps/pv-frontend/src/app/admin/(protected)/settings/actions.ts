"use server";

import { revalidatePath } from "next/cache";
import {
  BANK_SETTING_FIELDS,
  POLICY_SETTING_FIELDS,
  STORE_SETTING_FIELDS,
  settingsFormSchema,
  storeSettingsFormSchema,
  policySettingsFormSchema,
} from "@pv/backend/domain/schemas";
import { writeSettings } from "@pv/backend/services/settings";
import { requirePermission } from "@/server/session";
import { toActionError, type ActionState } from "@/lib/action-state";

/**
 * Builds the submission from the field list the schema is written against,
 * rather than from a hand-written set of reads.
 *
 * Those two drifted once already: `policy.returns` reached the schema and the
 * form but not the action, so every policy save failed validation and no policy
 * page could be edited from the admin. Reading the list makes that impossible
 * instead of merely fixed. Absent fields become "" so clearing a setting stays
 * expressible — the settings store treats blank as unset.
 */
function submissionFrom(formData: FormData, fields: readonly string[]) {
  return Object.fromEntries(fields.map((field) => [field, formData.get(field) ?? ""]));
}

export async function saveBankSettingsAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const principal = await requirePermission("settings.manage");
  const parsed = settingsFormSchema.safeParse(submissionFrom(formData, BANK_SETTING_FIELDS));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };

  try {
    await writeSettings(parsed.data, { staffId: principal.staffId });
  } catch (error) {
    return toActionError(error, "Bank details could not be saved.");
  }
  revalidatePath("/admin/settings");
  return { error: null, message: "Bank details saved." };
}

export async function saveStoreSettingsAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const principal = await requirePermission("settings.manage");
  const parsed = storeSettingsFormSchema.safeParse(submissionFrom(formData, STORE_SETTING_FIELDS));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };

  try {
    await writeSettings(parsed.data, { staffId: principal.staffId });
  } catch (error) {
    return toActionError(error, "Store details could not be saved.");
  }
  revalidatePath("/admin/settings");
  return { error: null, message: "Store details saved." };
}

export async function savePolicySettingsAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const principal = await requirePermission("settings.manage");
  const parsed = policySettingsFormSchema.safeParse(
    submissionFrom(formData, POLICY_SETTING_FIELDS),
  );
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };

  try {
    await writeSettings(parsed.data, { staffId: principal.staffId });
  } catch (error) {
    return toActionError(error, "Policy pages could not be saved.");
  }
  revalidatePath("/admin/settings");
  for (const path of ["/about", "/returns", "/privacy", "/terms"]) revalidatePath(path);
  return { error: null, message: "Policy pages saved." };
}
