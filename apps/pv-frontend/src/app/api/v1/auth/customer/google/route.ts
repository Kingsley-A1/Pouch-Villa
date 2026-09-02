import { z } from "zod";
import { loginCustomerWithGoogle } from "@pv/backend/services/customer-account";
import { ok, parseJson, requestContext, toApiError } from "@/server/api";
import { establishCustomerSession } from "@/server/customer-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const googleCredentialSchema = z.object({ credential: z.string().min(1).max(8192) });

/**
 * Google for customers.
 *
 * Unlike the staff path, this **may create an account**: a customer account
 * carries no authority, so proving control of a mailbox is enough to have one.
 * The lookup is against `customer` and never touches `staff`, so ADR 0002's
 * separate-stacks rule holds exactly where it matters — OAuth authenticates and
 * never authorises.
 */
export async function POST(request: Request) {
  const parsed = await parseJson(request, googleCredentialSchema);
  if (!parsed.ok) return parsed.response;

  const context = await requestContext();
  try {
    const { customerId } = await loginCustomerWithGoogle(parsed.data.credential, {
      ip: context.ip,
      requestId: context.requestId,
    });

    await establishCustomerSession(customerId);
    return ok({ customerId });
  } catch (error) {
    return toApiError(error);
  }
}
