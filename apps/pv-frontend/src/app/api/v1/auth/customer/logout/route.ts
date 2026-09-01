import { ok, toApiError } from "@/server/api";
import { clearCustomerSession } from "@/server/customer-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Revokes the session row as well as clearing the cookie — §5 requires both. */
export async function POST() {
  try {
    await clearCustomerSession();
    return ok({ signedOut: true });
  } catch (error) {
    return toApiError(error);
  }
}
