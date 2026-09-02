import { proofUploadFinaliseSchema } from "@pv/backend/domain/schemas";
import { normalisePhone } from "@pv/backend/domain/phone";
import { beginProofUpload, finaliseProofUpload } from "@pv/backend/services/payments";
import { getOrderById } from "@pv/backend/services/orders";
import {
  sendProofAwaitingReviewAlert,
  sendProofReceivedEmail,
} from "@pv/backend/services/order-email";
import { created, fail, ok, parseJson, requestContext, toApiError } from "@/server/api";
import { getCustomerPrincipal } from "@/server/customer-session";
import { hasOrderAccess } from "@/server/order-access";
import { dispatchEmail } from "@/server/notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Payment-proof upload, in the same two steps as product media: a pre-signed PUT
 * straight to R2 so the bytes never cross the app server, then a finalise call
 * that fetches them back and checks the magic bytes before anything points at
 * them.
 *
 * The bucket is **private** and no URL is ever returned for reading here — only
 * an authorised, audited staff request can produce one (§5, §8).
 *
 * Authorisation is no weaker than tracking's, and is re-derived server-side on
 * every call. A proof upload that only needed the order id would let anyone who
 * guessed one attach a document to a stranger's order. Three ways in, all of
 * them proving something the order id alone does not:
 *
 *   1. A session that owns the order.
 *   2. The short-lived grant issued at placement, naming this exact order —
 *      which is how a guest uploads a receipt straight after checking out,
 *      without retyping the number they entered a minute ago.
 *   3. The registered phone, for a guest returning later.
 */
async function authorise(orderId: string, request: Request): Promise<boolean> {
  const order = await getOrderById(orderId);
  if (order === null) return false;

  const customer = await getCustomerPrincipal();
  if (customer !== null && order.customerId === customer.customerId) return true;

  if (await hasOrderAccess(order.reference)) return true;

  const claimed = request.headers.get("x-order-phone");
  if (claimed === null) return false;
  const normalised = normalisePhone(claimed);
  return normalised !== null && normalised === order.contactPhone;
}

/** Step one: hand back a short-lived pre-signed PUT into the private bucket. */
export async function POST(request: Request, context: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await context.params;
  const contentType = request.headers.get("x-upload-content-type") ?? "";

  const allowed = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
  if (!allowed.includes(contentType)) {
    return fail("validation_failed", "Upload a JPEG, PNG, WebP or PDF of your transfer receipt.");
  }

  if (!(await authorise(orderId, request))) {
    return fail("forbidden", "We could not match that order to you.");
  }

  const requestInfo = await requestContext();
  try {
    const began = await beginProofUpload(orderId, contentType, { ip: requestInfo.ip });
    return created(began);
  } catch (error) {
    return toApiError(error);
  }
}

/** Step two: the object is untrusted until this has read it back and checked it. */
export async function PUT(request: Request, context: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await context.params;

  if (!(await authorise(orderId, request))) {
    return fail("forbidden", "We could not match that order to you.");
  }

  const parsed = await parseJson(request, proofUploadFinaliseSchema);
  if (!parsed.ok) return parsed.response;

  const requestInfo = await requestContext();
  try {
    const finalised = await finaliseProofUpload(parsed.data.uploadId, {
      ip: requestInfo.ip,
      requestId: requestInfo.requestId,
    });

    /**
     * Both sides of "we have your receipt". The buyer has paid and is now
     * waiting on a stranger to agree that they did, which is the most expensive
     * silence in the shop; staff previously learned about a proof only by
     * opening the admin and looking.
     *
     * Neither send carries the proof key or a URL to it — §5's closing rule.
     */
    dispatchEmail("Proof received", sendProofReceivedEmail(orderId));
    dispatchEmail("Proof awaiting review", sendProofAwaitingReviewAlert(orderId));

    // Deliberately no key and no URL in the response — §5's closing rule.
    return ok({ proofId: finalised.proofId, status: "pending" });
  } catch (error) {
    return toApiError(error);
  }
}
