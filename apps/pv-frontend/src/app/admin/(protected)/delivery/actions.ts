"use server";

import { revalidatePath } from "next/cache";
import { deliveryZoneSchema } from "@pv/backend/domain/schemas";
import * as delivery from "@pv/backend/services/delivery";
import { kobo } from "@pv/backend/domain/money";
import { requirePermission } from "@/server/session";
import { toActionError, type ActionState } from "@/lib/action-state";

function parseInput(formData: FormData) {
  return deliveryZoneSchema.safeParse({
    name: formData.get("name"),
    lga: formData.get("lga") || null,
    feeKobo: formData.get("feeNaira") ? Number(formData.get("feeNaira")) * 100 : 0,
    minDays: formData.get("minDays") || null,
    maxDays: formData.get("maxDays") || null,
    sortOrder: formData.get("sortOrder") || 0,
  });
}

export async function saveZoneAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const principal = await requirePermission("delivery.manage");
  const parsed = parseInput(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };

  const input = { ...parsed.data, feeKobo: kobo(parsed.data.feeKobo) };
  const id = formData.get("id");
  try {
    if (typeof id === "string" && id) {
      await delivery.updateDeliveryZone(id, input, { staffId: principal.staffId });
    } else {
      await delivery.createDeliveryZone(input, { staffId: principal.staffId });
    }
  } catch (error) {
    return toActionError(error, "The delivery zone could not be saved.");
  }
  revalidatePath("/admin/delivery");
  return { error: null, message: "Delivery zone saved." };
}

export async function setZoneActiveAction(id: string, isActive: boolean) {
  const principal = await requirePermission("delivery.manage");
  await delivery.setDeliveryZoneActive(id, isActive, { staffId: principal.staffId });
  revalidatePath("/admin/delivery");
}

export async function deleteZoneAction(id: string, reason: string): Promise<ActionState> {
  const principal = await requirePermission("delivery.manage");
  await delivery.softDeleteDeliveryZone(id, reason, { staffId: principal.staffId });
  revalidatePath("/admin/delivery");
  return { error: null };
}
