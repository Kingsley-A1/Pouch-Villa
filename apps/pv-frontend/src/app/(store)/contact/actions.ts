"use server";

import { contactRequestSchema } from "@pv/backend/domain/schemas";
import { submitContactRequest } from "@pv/backend/services/contact";
import { notifyEnquiry } from "@/server/enquiry-notifications";
import { toActionError, type ActionState } from "@/lib/action-state";
import { currentRequestContext } from "@/server/session";

/** A thin adapter over the same service `app/api/v1/contact` calls — ADR 0003. */
export async function submitContactAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = contactRequestSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email") || null,
    phone: formData.get("phone") || null,
    subject: formData.get("subject") || null,
    message: formData.get("message"),
    orderReference: formData.get("orderReference") || null,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the highlighted fields." };
  }

  const context = await currentRequestContext();
  let enquiryId: string;
  try {
    ({ enquiryId } = await submitContactRequest(parsed.data, { ip: context.ip }));
  } catch (error) {
    return toActionError(error, "Your message could not be sent. Please try again.");
  }

  // Outside the try, and never awaited: the enquiry is recorded, and a mail
  // provider being unreachable must not turn that into an error on the
  // customer's screen.
  notifyEnquiry(enquiryId);

  return { error: null, message: "Thank you. We will get back to you." };
}
