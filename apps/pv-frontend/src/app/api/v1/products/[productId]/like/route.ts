import { toggleLike } from "@pv/backend/services/likes";
import { assertWithinRateLimit, recordRateLimitHits } from "@pv/backend/services/rate-limit";
import { ok, requestContext, toApiError } from "@/server/api";
import { resolveOrCreateLikeActor } from "@/server/like-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Likes or unlikes one product, and answers with the state the button should
 * show. There is no separate unlike endpoint: the row's existence *is* the
 * state, so one idempotent toggle is both simpler and impossible to get out of
 * step with what the database holds.
 *
 * Deliberately open to signed-out visitors. Requiring an account would measure
 * almost nothing on a shop whose visitors are overwhelmingly signed out, and the
 * scope asks for "like & share", not "like, once you have registered".
 */
export async function POST(_request: Request, context: { params: Promise<{ productId: string }> }) {
  const { productId } = await context.params;
  const { ip } = await requestContext();

  try {
    await assertWithinRateLimit("product.like", [ip]);

    const actor = await resolveOrCreateLikeActor();
    const state = await toggleLike(productId, actor);

    await recordRateLimitHits("product.like", [ip]);
    return ok(state);
  } catch (error) {
    return toApiError(error);
  }
}
