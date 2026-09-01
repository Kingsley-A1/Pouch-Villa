"use server";

import { redirect } from "next/navigation";
import { orderTrackingSchema } from "@pv/backend/domain/schemas";
import { normaliseOrderReference } from "@pv/backend/domain/reference";
import { findOrderForTracking } from "@pv/backend/services/orders";
import { assertWithinRateLimit, recordRateLimitHits } from "@pv/backend/services/rate-limit";
import { toActionError, type ActionState } from "@/lib/action-state";
import { grantOrderAccess } from "@/server/order-access";
import { currentRequestContext } from "@/server/session";

/**
 * Order tracking, authorised by reference **plus** the registered phone — ADR
 * 0002. The reference alone is not enough, because it travels in a bank
 * narration and is seen by people who are not the customer.
 *
 * A wrong reference and a wrong phone give the identical answer, so this never
 * confirms that a reference exists to someone who cannot also prove the number.
 */
export async function trackOrderAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = orderTrackingSchema.safeParse({
    reference: formData.get("reference"),
    phone: formData.get("phone"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the details and try again." };
  }

  const context = await currentRequestContext();
  const notFound = { error: "We could not find an order with those details." };

  let reference: string;
  try {
    // Rate limited per IP: without it this is an oracle for pairing a reference
    // with a phone number by brute force.
    await assertWithinRateLimit("order.track", [context.ip]);
    await recordRateLimitHits("order.track", [context.ip]);

    const normalised = normaliseOrderReference(parsed.data.reference);
    if (normalised === null) return notFound;

    const order = await findOrderForTracking(normalised, parsed.data.phone);
    if (order === null) return notFound;
    reference = order.reference;
  } catch (error) {
    return toActionError(error, "We could not look that order up. Please try again.");
  }

  // Proving the phone earns the same short-lived grant placement issues, so the
  // order page opens without asking for it a second time.
  await grantOrderAccess(reference);
  redirect(`/orders/${reference}`);
}
