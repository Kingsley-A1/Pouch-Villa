import { customerSignUpSchema } from "@pv/backend/domain/schemas";
import { signUp } from "@pv/backend/services/customer-account";
import { mergeGuestCart } from "@pv/backend/services/cart";
import { created, parseJson, requestContext, toApiError } from "@/server/api";
import { createCustomerSession } from "@/server/customer-session";
import { readCartToken } from "@/server/cart-session";

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

    // Whatever was in the guest cart follows them into the account.
    const token = await readCartToken();
    if (token !== null) await mergeGuestCart(token, customerId).catch(() => {});

    await createCustomerSession(customerId);
    return created({ customerId });
  } catch (error) {
    return toApiError(error);
  }
}
