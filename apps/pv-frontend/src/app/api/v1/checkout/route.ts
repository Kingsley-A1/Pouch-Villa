import { checkoutSchema } from "@pv/backend/domain/schemas";
import { placeOrder } from "@pv/backend/services/orders";
import {
  pick,
  readSettings,
  type SettingKey,
  type SettingValue,
} from "@pv/backend/services/settings";
import { sendOrderPlacedEmail } from "@pv/backend/services/order-email";
import { created, fail, idempotencyKey, parseJson, requestContext, toApiError } from "@/server/api";
import { clearCartCookie, resolveExistingCartId } from "@/server/cart-session";
import { getCustomerPrincipal } from "@/server/customer-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Order placement.
 *
 * The `Idempotency-Key` header is **required**, not optional, and is not
 * generated here when missing: a key the server invents cannot deduplicate a
 * retry, because the retry would invent a different one. Nigerian mobile data
 * drops mid-request and a double-submitted order is the foreseeable loss
 * AGENTS.md §3 names, so a caller that omits the key is told to send one.
 *
 * The Server Action that backs the checkout form generates a key once, when the
 * form is first rendered, and sends the same one on every retry.
 */
export async function POST(request: Request) {
  const key = idempotencyKey(request);
  if (key === null) {
    return fail(
      "validation_failed",
      "An Idempotency-Key header is required so a retried order is not placed twice.",
    );
  }

  const parsed = await parseJson(request, checkoutSchema);
  if (!parsed.ok) return parsed.response;

  const cartId = await resolveExistingCartId();
  if (cartId === null) return fail("conflict", "Your cart is empty.");

  const customer = await getCustomerPrincipal();
  const context = await requestContext();

  let placed;
  try {
    placed = await placeOrder(
      {
        cartId,
        idempotencyKey: key,
        ...parsed.data,
        customerId: customer?.customerId ?? null,
      },
      { ip: context.ip, requestId: context.requestId },
    );
  } catch (error) {
    return toApiError(error);
  }

  // Everything past this point is an external effect and therefore deliberately
  // outside the transaction, per the warning on `withTransaction`. A failure
  // here must not undo a committed order.
  if (!placed.replayed) {
    await clearCartCookie().catch(() => {});
  }

  const settings = await readSettings([
    "bank.account_name",
    "bank.account_number",
    "bank.bank_name",
  ]).catch(() => null);

  // A confirmation email is a courtesy, not part of placing the order. If Resend
  // is unconfigured or down, the customer still has their reference on screen.
  void sendOrderPlacedEmail(placed.orderId).catch((error: unknown) => {
    console.error("Order confirmation email failed", {
      name: error instanceof Error ? error.name : typeof error,
    });
  });

  return created({
    orderId: placed.orderId,
    reference: placed.reference,
    totalKobo: placed.totalKobo,
    replayed: placed.replayed,
    /**
     * The transfer instructions travel with the response so the client needs no
     * second round trip on a connection that may already be struggling. Absence
     * is typed — an unset bank detail is `null`, never a blank string rendered
     * where an account number should be (§4).
     */
    bankDetails:
      settings === null
        ? null
        : {
            accountName: valueOrNull(settings, "bank.account_name"),
            accountNumber: valueOrNull(settings, "bank.account_number"),
            bankName: valueOrNull(settings, "bank.bank_name"),
          },
  });
}

/**
 * Collapses the settings store's typed absence into the `string | null` a JSON
 * response can carry.
 *
 * `pick` is what narrows the union: reading `.value` off a bare `Map.get()`
 * cannot, because testing the discriminant and reading the field are two
 * separate lookups as far as the compiler is concerned.
 */
function valueOrNull(settings: Map<SettingKey, SettingValue>, key: SettingKey): string | null {
  const setting = pick(settings, key);
  return setting.present ? setting.value : null;
}
