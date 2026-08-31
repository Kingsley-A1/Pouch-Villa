"use server";

import { revalidatePath } from "next/cache";
import {
  settingsFormSchema,
  storeSettingsFormSchema,
  policySettingsFormSchema,
} from "@pv/backend/domain/schemas";
import { writeSettings } from "@pv/backend/services/settings";
import { requirePermission } from "@/server/session";
import { toActionError, type ActionState } from "@/lib/action-state";

export async function saveBankSettingsAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const principal = await requirePermission("settings.manage");
  const parsed = settingsFormSchema.safeParse({
    "bank.account_name": formData.get("bank.account_name") ?? "",
    "bank.account_number": formData.get("bank.account_number") ?? "",
    "bank.bank_name": formData.get("bank.bank_name") ?? "",
  });
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
  const parsed = storeSettingsFormSchema.safeParse({
    "store.address": formData.get("store.address") ?? "",
    "store.opening_hours": formData.get("store.opening_hours") ?? "",
    "store.whatsapp_number": formData.get("store.whatsapp_number") ?? "",
    "store.contact_email": formData.get("store.contact_email") ?? "",
  });
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
  const parsed = policySettingsFormSchema.safeParse({
    "policy.about": formData.get("policy.about") ?? "",
    "policy.privacy": formData.get("policy.privacy") ?? "",
    "policy.terms": formData.get("policy.terms") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };

  try {
    await writeSettings(parsed.data, { staffId: principal.staffId });
  } catch (error) {
    return toActionError(error, "Policy pages could not be saved.");
  }
  revalidatePath("/admin/settings");
  return { error: null, message: "Policy pages saved." };
}
