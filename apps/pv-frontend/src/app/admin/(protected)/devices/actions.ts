"use server";

import { revalidatePath } from "next/cache";
import { deviceSchema } from "@pv/backend/domain/schemas";
import * as devices from "@pv/backend/services/devices";
import { requirePermission } from "@/server/session";
import { toActionError, type ActionState } from "@/lib/action-state";

function parseInput(formData: FormData) {
  return deviceSchema.safeParse({
    brandId: formData.get("brandId"),
    name: formData.get("name"),
    releasedYear: formData.get("releasedYear") || null,
    sortOrder: formData.get("sortOrder") || 0,
  });
}

export async function saveDeviceAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const principal = await requirePermission("category.manage");
  const parsed = parseInput(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };

  const id = formData.get("id");
  try {
    if (typeof id === "string" && id) {
      await devices.updateDevice(id, parsed.data, { staffId: principal.staffId });
    } else {
      await devices.createDevice(parsed.data, { staffId: principal.staffId });
    }
  } catch (error) {
    return toActionError(error, "The device could not be saved.");
  }
  revalidatePath("/admin/devices");
  return { error: null, message: "Device saved." };
}

export async function deleteDeviceAction(id: string): Promise<ActionState> {
  const principal = await requirePermission("category.manage");
  try {
    await devices.deleteDevice(id, { staffId: principal.staffId });
  } catch (error) {
    return toActionError(error, "The device could not be removed.");
  }
  revalidatePath("/admin/devices");
  return { error: null };
}
