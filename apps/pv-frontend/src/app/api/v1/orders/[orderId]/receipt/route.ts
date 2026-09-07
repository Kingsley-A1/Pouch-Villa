import { getOrderById } from "@pv/backend/services/orders";
import {
  buildOrderDocumentFor,
  type OrderDocumentKind,
} from "@pv/backend/services/order-documents";
import { staffHasPermission } from "@pv/backend/services/roles";
import { getCustomerPrincipal } from "@/server/customer-session";
import { getStaffPrincipal } from "@/server/session";
import { hasOrderAccess } from "@/server/order-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * An order's invoice or payment receipt, as a PDF.
 *
 * **One route for both readers.** The customer downloading their own receipt and
 * the staff member downloading the same order's invoice get the same bytes from
 * the same code. Two routes would be two places to decide who may read what, and
 * the day they disagree is the day one of them is wrong — this is the reasoning
 * the proof-document route already applies to its `?download=1` flag.
 *
 * **Authority is re-derived here, every time.** Three ways in, and the URL is
 * none of them: a staff session carrying `order.view`, the customer whose
 * account owns the order, or the short-lived grant issued at placement. A guest
 * whose grant has lapsed is refused and goes back through `/track`, where the
 * registered phone is proved — exactly as ADR 0002 requires of every other way
 * of reaching an order.
 *
 * **Not audited, deliberately.** `readProofDocument` audits because a payment
 * proof is a bank document that §5 names specifically. An invoice carries no
 * bank details (see `order-documents.ts`) and shows the staff reader nothing the
 * admin order page already shows them without one. An audit trail that records
 * every glance is one nobody reads when it matters.
 */

const KINDS: Readonly<Record<string, OrderDocumentKind>> = {
  invoice: "invoice",
  receipt: "receipt",
};

export async function GET(request: Request, context: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await context.params;

  const requested = new URL(request.url).searchParams.get("kind") ?? "invoice";
  const kind = KINDS[requested];
  if (kind === undefined) {
    return new Response("Not found", { status: 404 });
  }

  const order = await getOrderById(orderId);
  // The same 404 as an unknown id, so this cannot be used to discover which
  // order ids exist by watching which ones answer differently.
  if (order === null) return new Response("Not found", { status: 404 });

  if (!(await mayRead(order.customerId, order.reference))) {
    return new Response("Not found", { status: 404 });
  }

  let document;
  try {
    document = await buildOrderDocumentFor(order, kind);
  } catch (error) {
    // §5: a render failure may name a storage path or carry a driver message.
    // The reader gets a status; the log gets a name and nothing else.
    console.error("Order document render failed", {
      name: error instanceof Error ? error.name : typeof error,
    });
    return new Response("Not found", { status: 404 });
  }

  return new Response(new Uint8Array(document.bytes), {
    headers: {
      "Content-Type": document.contentType,
      "Content-Length": String(document.bytes.byteLength),
      "Content-Disposition": `attachment; filename="${document.filename}"`,
      // Carries a name, a phone number and an address. It must not sit in a
      // shared cache, nor in this browser's disk cache after a sign-out.
      "Cache-Control": "no-store, private",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

async function mayRead(customerId: string | null, reference: string): Promise<boolean> {
  const staff = await getStaffPrincipal();
  if (staff !== null && (await staffHasPermission(staff.staffId, "order.view"))) return true;

  const customer = await getCustomerPrincipal();
  if (customer !== null && customerId === customer.customerId) return true;

  return hasOrderAccess(reference);
}
