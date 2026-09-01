"use server";

import { revalidatePath } from "next/cache";
import { contactStatusSchema } from "@pv/backend/domain/schemas";
import { setContactStatus, softDeleteContactRequest } from "@pv/backend/services/contact";
import { toActionError, type ActionState } from "@/lib/action-state";
import { requirePermission } from "@/server/session";

export async function setEnquiryStatusAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const principal = await requirePermission("enquiry.manage");

  const parsed = contactStatusSchema.safeParse({
    id: formData.get("id"),
    status: formData.get("status"),
    note: formData.get("note") || null,
  });
  if (!parsed.success) return { error: "That enquiry could not be updated." };

  try {
    await setContactStatus(
      parsed.data.id,
      parsed.data.status,
      { staffId: principal.staffId },
      parsed.data.note,
    );
  } catch (error) {
    return toActionError(error, "That enquiry could not be updated.");
  }

  revalidatePath("/admin/contact");
  return { error: null, message: "Updated." };
}

/** Soft-delete with an actor and a reason — nothing is hard-deleted (§6). */
export async function deleteEnquiryAction(id: string): Promise<void> {
  const principal = await requirePermission("enquiry.manage");
  await softDeleteContactRequest(id, "Removed by staff", { staffId: principal.staffId });
  revalidatePath("/admin/contact");
}
