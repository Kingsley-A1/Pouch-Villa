import { customerLoginSchema } from "@pv/backend/domain/schemas";
import { loginCustomerWithPassword } from "@pv/backend/services/customer-account";
import { ok, parseJson, requestContext, toApiError } from "@/server/api";
import { establishCustomerSession } from "@/server/customer-session";

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

    await establishCustomerSession(customerId);
    return ok({ customerId });
  } catch (error) {
    return toApiError(error);
  }
}
