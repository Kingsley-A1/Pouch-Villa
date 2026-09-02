import { contactRequestSchema } from "@pv/backend/domain/schemas";
import { submitContactRequest } from "@pv/backend/services/contact";
import { created, parseJson, requestContext, toApiError } from "@/server/api";
import { notifyEnquiry } from "@/server/enquiry-notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Contact requests — scope item 12.
 *
 * The prototype's contact flow was a WhatsApp message preview that deliberately
 * sent nothing. This records the enquiry so a staff member can actually see and
 * answer it. Rate limited per IP and per contact detail, per §5.
 */
export async function POST(request: Request) {
  const parsed = await parseJson(request, contactRequestSchema);
  if (!parsed.ok) return parsed.response;

  const context = await requestContext();
  try {
    const { enquiryId } = await submitContactRequest(parsed.data, {
      ip: context.ip,
      requestId: context.requestId,
    });
    notifyEnquiry(enquiryId);
    return created({ enquiryId, message: "Thank you. We will get back to you." });
  } catch (error) {
    return toApiError(error);
  }
}
