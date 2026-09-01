import {
  passwordResetCompleteSchema,
  passwordResetRequestSchema,
} from "@pv/backend/domain/schemas";
import { completePasswordReset, requestPasswordReset } from "@pv/backend/services/customer-account";
import { sendPasswordResetEmail } from "@pv/backend/services/order-email";
import { ok, parseJson, requestContext, toApiError } from "@/server/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Step one: ask for a code.
 *
 * This **always** reports success, whether or not the address is registered.
 * Distinguishing the two would turn password reset into an account-enumeration
 * oracle, and the person who genuinely owns the address learns nothing from the
 * difference.
 */
export async function POST(request: Request) {
  const parsed = await parseJson(request, passwordResetRequestSchema);
  if (!parsed.ok) return parsed.response;

  const context = await requestContext();
  try {
    const issued = await requestPasswordReset(parsed.data.email, {
      ip: context.ip,
      requestId: context.requestId,
    });

    // Sending is an external effect, outside the transaction and best-effort.
    // The uniform response below does not depend on it.
    if (issued !== null) {
      void sendPasswordResetEmail(parsed.data.email, issued.code).catch((error: unknown) => {
        console.error("Password reset email failed", {
          name: error instanceof Error ? error.name : typeof error,
        });
      });
    }

    return ok({ sent: true });
  } catch (error) {
    return toApiError(error);
  }
}

/** Step two: redeem the code and set the new password. */
export async function PUT(request: Request) {
  const parsed = await parseJson(request, passwordResetCompleteSchema);
  if (!parsed.ok) return parsed.response;

  const context = await requestContext();
  try {
    await completePasswordReset(parsed.data.email, parsed.data.code, parsed.data.password, {
      ip: context.ip,
      requestId: context.requestId,
    });
    return ok({ reset: true });
  } catch (error) {
    return toApiError(error);
  }
}
