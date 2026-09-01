import { orderTrackingSchema } from "@pv/backend/domain/schemas";
import { normaliseOrderReference } from "@pv/backend/domain/reference";
import { findOrderForTracking } from "@pv/backend/services/orders";
import { assertWithinRateLimit, recordRateLimitHits } from "@pv/backend/services/rate-limit";
import { fail, ok, parseJson, requestContext, toApiError } from "@/server/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Order tracking, authorised by **reference plus registered phone**.
 *
 * ADR 0002 makes the customer's email a contact channel rather than an identity
 * proof, so the reference alone is deliberately not enough — a reference travels
 * in a bank narration and is seen by people who are not the customer, and it
 * would otherwise disclose their address and phone number.
 *
 * A POST rather than a GET because the phone number is a credential here, and a
 * credential in a query string ends up in server logs and browser history.
 *
 * Rate limited per IP: without it, this is an oracle for guessing which
 * reference belongs to which number.
 */
export async function POST(request: Request) {
  const parsed = await parseJson(request, orderTrackingSchema);
  if (!parsed.ok) return parsed.response;

  const context = await requestContext();
  const reference = normaliseOrderReference(parsed.data.reference);

  try {
    await assertWithinRateLimit("order.track", [context.ip]);
    await recordRateLimitHits("order.track", [context.ip]);
  } catch (error) {
    return toApiError(error);
  }

  // A malformed reference and a wrong one give the same answer, so the response
  // never distinguishes "no such order" from "not your order".
  if (reference === null) {
    return fail("not_found", "We could not find an order with those details.");
  }

  try {
    const order = await findOrderForTracking(reference, parsed.data.phone);
    if (order === null) {
      return fail("not_found", "We could not find an order with those details.");
    }
    return ok(order);
  } catch (error) {
    return toApiError(error);
  }
}
