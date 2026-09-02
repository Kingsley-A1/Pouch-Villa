"use server";

import { revalidatePath } from "next/cache";
import { proofDecisionSchema, proofRejectionSchema } from "@pv/backend/domain/schemas";
import { acceptProof, getProofViewUrl, rejectProof } from "@pv/backend/services/payments";
import {
  sendPaymentConfirmedEmail,
  sendProofRejectedEmail,
} from "@pv/backend/services/order-email";
import { toActionError, type ActionState } from "@/lib/action-state";
import { dispatchEmail } from "@/server/notify";
import { requirePermission } from "@/server/session";

/**
 * Payment proof review.
 *
 * Payment proofs are financial documents containing bank details, so every one
 * of these paths is permission-checked server-side and audited, and the signed
 * URL is issued only by an explicit request that records who asked (§5, §8).
 */

/**
 * Issues a short-lived signed URL for one proof and **audits the access**.
 *
 * Returned to the caller and never stored, never logged, and never put into an
 * error message — §5's closing rule names payment-proof URLs specifically. It is
 * deliberately an action rather than page data, so a URL is minted only when a
 * staff member actually opens a document, not every time the list renders.
 */
export async function viewProofAction(
  proofId: string,
): Promise<{ url: string; contentType: string } | { error: string }> {
  const principal = await requirePermission("payment.view");
  try {
    return await getProofViewUrl(proofId, { staffId: principal.staffId });
  } catch (error) {
    console.error("Proof view failed", {
      name: error instanceof Error ? error.name : typeof error,
    });
    return { error: "That document could not be opened." };
  }
}

export async function acceptProofAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const principal = await requirePermission("payment.confirm");

  const parsed = proofDecisionSchema.safeParse({
    proofId: formData.get("proofId"),
    note: formData.get("note") || null,
  });
  if (!parsed.success) return { error: "That decision could not be recorded." };

  let orderId: string;
  try {
    const accepted = await acceptProof(
      parsed.data.proofId,
      { staffId: principal.staffId },
      parsed.data.note,
    );
    orderId = accepted.orderId;
  } catch (error) {
    return toActionError(error, "That payment could not be confirmed.");
  }

  // Q6, in the client's own words: "user gets Email notification that payment is
  // received". Outside the transaction and best-effort.
  dispatchEmail("Payment confirmation", sendPaymentConfirmedEmail(orderId));

  revalidatePath("/admin/payments");
  revalidatePath("/admin/orders");
  return { error: null, message: "Payment confirmed and the buyer has been emailed." };
}

export async function rejectProofAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const principal = await requirePermission("payment.confirm");

  const parsed = proofRejectionSchema.safeParse({
    proofId: formData.get("proofId"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Say why, so the buyer can fix it." };
  }

  let orderId: string;
  try {
    const rejected = await rejectProof(parsed.data.proofId, parsed.data.reason, {
      staffId: principal.staffId,
    });
    orderId = rejected.orderId;
  } catch (error) {
    return toActionError(error, "That proof could not be rejected.");
  }

  /**
   * The reason is collected so it can be given to the buyer, and until now it
   * never left the database. Someone who believes they have paid was returned to
   * awaiting-payment in silence and found out only by reopening the tracking
   * page — or by transferring a second time.
   */
  dispatchEmail("Proof rejection", sendProofRejectedEmail(orderId, parsed.data.reason));

  revalidatePath("/admin/payments");
  revalidatePath("/admin/orders");
  return { error: null, message: "Returned to the buyer, with your reason, for another attempt." };
}
