import { getRatingSummary, listApprovedReviews } from "@pv/backend/services/reviews";
import { ok, toApiError } from "@/server/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Published reviews for one product.
 *
 * Only approved, undeleted reviews, and the returned shape deliberately carries
 * no reviewer email and no submitting IP — neither is ever rendered, so neither
 * leaves the server.
 */
export async function GET(_request: Request, context: { params: Promise<{ productId: string }> }) {
  const { productId } = await context.params;
  try {
    const [reviews, summary] = await Promise.all([
      listApprovedReviews(productId),
      getRatingSummary(productId),
    ]);
    return ok({ reviews, summary });
  } catch (error) {
    return toApiError(error);
  }
}
