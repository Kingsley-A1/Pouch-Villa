import { customerLoginSchema } from "@pv/backend/domain/schemas";
import { loginCustomerWithPassword } from "@pv/backend/services/customer-account";
import { mergeGuestCart } from "@pv/backend/services/cart";
import { ok, parseJson, requestContext, toApiError } from "@/server/api";
import { createCustomerSession } from "@/server/customer-session";
import { readCartToken } from "@/server/cart-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const parsed = await parseJson(request, customerLoginSchema);
  if (!parsed.ok) return parsed.response;

  const context = await requestContext();
  try {
    const { customerId } = await loginCustomerWithPassword(
      parsed.data.email,
      parsed.data.password,
      { ip: context.ip, requestId: context.requestId },
    );

    const token = await readCartToken();
    if (token !== null) await mergeGuestCart(token, customerId).catch(() => {});

    // §5: the session id rotates on sign-in — a fresh session row is issued
    // rather than an existing one reused.
    await createCustomerSession(customerId);
    return ok({ customerId });
  } catch (error) {
    return toApiError(error);
  }
}
