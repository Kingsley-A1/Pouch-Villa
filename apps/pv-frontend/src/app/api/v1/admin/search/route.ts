import { adminSearchQuerySchema } from "@pv/backend/domain/schemas";
import { searchAdmin } from "@pv/backend/services/admin-search";
import { assertWithinRateLimit, recordRateLimitHit } from "@pv/backend/services/rate-limit";
import { fail, ok, toApiError } from "@/server/api";
import { getStaffPrincipal } from "@/server/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = { "Cache-Control": "private, no-store, max-age=0" };

export async function GET(request: Request) {
  const principal = await getStaffPrincipal();
  if (principal === null) return fail("unauthenticated", "Sign in to search the admin.");

  const url = new URL(request.url);
  const parsed = adminSearchQuerySchema.safeParse({
    q: url.searchParams.get("q") ?? "",
    limit: url.searchParams.get("limit") ?? undefined,
  });
  if (!parsed.success) {
    return fail("validation_failed", "Enter a search of up to 120 characters.");
  }

  try {
    await assertWithinRateLimit("admin.search", [principal.staffId]);
    const results = await searchAdmin(principal.staffId, {
      query: parsed.data.q,
      limit: parsed.data.limit,
    });
    await recordRateLimitHit("admin.search", principal.staffId);
    return ok({ results }, { headers: NO_STORE_HEADERS });
  } catch (error) {
    return toApiError(error);
  }
}
