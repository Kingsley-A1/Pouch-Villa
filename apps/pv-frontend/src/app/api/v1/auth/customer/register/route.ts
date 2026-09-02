import { customerSignUpSchema } from "@pv/backend/domain/schemas";
import { signUp } from "@pv/backend/services/customer-account";
import { sendWelcomeEmail } from "@pv/backend/services/account-email";
import { created, parseJson, requestContext, toApiError } from "@/server/api";
import { establishCustomerSession } from "@/server/customer-session";
import { dispatchEmail } from "@/server/notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Customer registration. Per ADR 0002 there is no email verification and no
 * second screen — an inbox round-trip mid-checkout is the most expensive step we
 * could add, and nothing about ordering depends on proving the address.
 */
export async function POST(request: Request) {
  const parsed = await parseJson(request, customerSignUpSchema);
  if (!parsed.ok) return parsed.response;

  const context = await requestContext();
  try {
    const { customerId } = await signUp(parsed.data, {
      ip: context.ip,
      requestId: context.requestId,
    });

    // Cart, likes and a fresh session — see `establishCustomerSession`.
    await establishCustomerSession(customerId);
    dispatchEmail("Welcome", sendWelcomeEmail(parsed.data.email, parsed.data.fullName ?? null));
    return created({ customerId });
  } catch (error) {
    return toApiError(error);
  }
}
