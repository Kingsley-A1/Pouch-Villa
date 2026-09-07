import { formatKoboForDocument } from "../domain/money";
import { formatPhoneLocal } from "../domain/phone";
import { absoluteSiteUrl } from "../domain/site-origin";
import {
  renderInvoicePdf,
  type InvoiceDocument,
  type InvoiceLine,
  type InvoiceMetaRow,
} from "../documents/invoice-pdf";
import { getOrderById, type Order, type OrderLine } from "./orders";
import { listProofsForOrder } from "./payments";
import { readSettings, type SettingKey, type SettingValue } from "./settings";

/**
 * The two documents an order produces, and the only place that decides what goes
 * on them.
 *
 * **Why two and not one.** They answer different questions and are true at
 * different moments. The invoice says *this is what you ordered and what it
 * costs*, and exists from the second the order is placed. The payment receipt
 * says *this is what we have received against it*, and cannot exist before
 * somebody has paid. Merging them would mean issuing a document headed RECEIPT
 * to a customer who has not yet transferred anything — which is the one thing a
 * receipt must never say.
 *
 * **Neither carries bank details.** The order-placed email already sets out the
 * transfer details, in the message the customer is looking at when they pay. A
 * PDF is the more forwardable of the two, and §5's rule about not repeating bank
 * details into a second context is the reason `sendProofRejectedEmail` does not
 * repeat them either. The invoice is a statement of what is owed, not a second
 * copy of where to send it.
 *
 * **The QR code carries a link, not an entitlement.** It resolves to this
 * order's page, where authority is re-derived exactly as it is for anyone typing
 * the URL: the owner's session, the short-lived placement grant, or `/track`
 * with the registered phone. A receipt can be photographed off a desk, so a QR
 * that granted access by itself would be a bearer token printed on paper.
 */

/**
 * The shop's own trading name, as it is written everywhere else in this package
 * — every email subject, the site title, the OpenGraph card. §4 is about facts a
 * wrong value would turn into a lie a customer discovers: a phone number, a
 * price, an account number. What the shop is called is not one of those, and
 * putting it behind a setting would mean an unset row renders an unnamed invoice.
 */
const SHOP_NAME = "Pouch Villa";

/**
 * Our own credit line, exactly as the client asked for it. It is a statement
 * about who built the document, in the position their reference put it.
 */
const FOOTER_CREDIT = "Powered by Bespoke Invoice";

const DOCUMENT_SETTINGS: readonly SettingKey[] = [
  "store.address",
  "store.contact_email",
  "store.whatsapp_number",
  "store.invoice_terms",
];

export type OrderDocumentKind = "invoice" | "receipt";

export type OrderDocumentFile = {
  bytes: Uint8Array;
  filename: string;
  contentType: "application/pdf";
};

function value(settings: Map<SettingKey, SettingValue>, key: SettingKey): string | null {
  const setting = settings.get(key);
  return setting !== undefined && setting.present ? setting.value : null;
}

/** §6: timestamps are stored UTC and rendered in Africa/Lagos. */
function lagosDate(when: Date): string {
  return new Intl.DateTimeFormat("en-NG", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Africa/Lagos",
  }).format(when);
}

function lagosDateTime(when: Date): string {
  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Lagos",
  }).format(when);
}

/**
 * One table row per order line.
 *
 * The variant matters here in a way it does not on the order page: a receipt is
 * what somebody holds up when the wrong colour arrives, so the axes and the SKU
 * are part of the description rather than a detail the page happens to show.
 */
function describeLine(line: OrderLine): string {
  const axes = Object.values(line.axes).filter((axis) => axis.length > 0);
  const parts = [line.productName];
  if (line.brandName !== null) parts.push(line.brandName);
  if (axes.length > 0) parts.push(axes.join(" / "));
  parts.push(line.variantSku);
  return `${parts.join(" · ")} × ${line.quantity}`;
}

function invoiceLines(order: Order): InvoiceLine[] {
  return order.lines.map((line) => ({
    description: describeLine(line),
    amount: formatKoboForDocument(line.lineTotalKobo),
  }));
}

function shopLines(settings: Map<SettingKey, SettingValue>): string[] {
  // Only what the admin has actually filled in. An unset row leaves the line
  // out; it never renders a gap where an address should be (§0 rule 2).
  return [
    value(settings, "store.address"),
    value(settings, "store.whatsapp_number"),
    value(settings, "store.contact_email"),
  ].filter((line): line is string => line !== null);
}

function billToLines(order: Order): string[] {
  const lines = [formatPhoneLocal(order.contactPhone), order.contactEmail];
  if (order.fulfilment === "delivery" && order.deliveryAddress !== null) {
    lines.push(order.deliveryAddress);
    if (order.deliveryLga !== null) lines.push(order.deliveryLga);
  }
  return lines;
}

function terms(settings: Map<SettingKey, SettingValue>): InvoiceDocument["terms"] {
  const written = value(settings, "store.invoice_terms");
  if (written === null) return { heading: "", lines: [] };
  return {
    heading: "Terms & Conditions",
    lines: written
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean),
  };
}

function subtotalRows(order: Order): InvoiceDocument["subtotals"] {
  return [
    { label: "Subtotal", amount: formatKoboForDocument(order.subtotalKobo) },
    {
      label: order.fulfilment === "pickup" ? "Collection" : "Delivery",
      amount: formatKoboForDocument(order.deliveryFeeKobo),
    },
  ];
}

/** Where a scan lands. Authority is decided there, not by holding the code. */
function orderUrl(order: Order): string {
  return absoluteSiteUrl(`/orders/${encodeURIComponent(order.reference)}`);
}

/**
 * How much of the order's money is actually settled, and in whose words.
 *
 * A payment receipt issued the moment a transfer screenshot lands is issued
 * before anyone has checked it. Saying "PAID" then would be a document the shop
 * did not mean and the customer would reasonably rely on. So the receipt states
 * where the payment has got to, and the total is labelled to match: money that
 * has been confirmed reads as paid, money that has only been claimed does not.
 */
type PaymentState = {
  status: string;
  totalLabel: string;
  receivedAt: Date | null;
  confirmed: boolean;
};

async function paymentState(order: Order): Promise<PaymentState> {
  const confirmed =
    order.status !== "awaiting_payment" &&
    order.status !== "proof_submitted" &&
    order.status !== "cancelled";

  const proofs = await listProofsForOrder(order.id);
  const accepted = proofs.find((proof) => proof.status === "accepted");
  const pending = proofs.find((proof) => proof.status === "pending");
  const latest = accepted ?? pending ?? proofs[0] ?? null;

  if (confirmed) {
    return {
      status: "Confirmed",
      totalLabel: "Total paid",
      receivedAt: accepted?.uploadedAt ?? latest?.uploadedAt ?? null,
      confirmed: true,
    };
  }

  if (pending !== undefined) {
    return {
      status: "Under review",
      totalLabel: "Total due",
      receivedAt: pending.uploadedAt,
      confirmed: false,
    };
  }

  return {
    status: order.status === "cancelled" ? "Order cancelled" : "Awaiting payment",
    totalLabel: "Total due",
    receivedAt: null,
    confirmed: false,
  };
}

function buildInvoice(order: Order, settings: Map<SettingKey, SettingValue>): InvoiceDocument {
  return {
    title: "Invoice",
    shopName: SHOP_NAME,
    shopLines: shopLines(settings),
    billTo: { heading: "Bill to", name: order.contactName, lines: billToLines(order) },
    meta: [
      // The order reference *is* the invoice number. Inventing a second
      // sequence would give the shop two ways to name one order, and the
      // reference is already the one that travels — it is what a bank narration
      // carries and what staff read down the phone.
      { label: "Invoice #", value: order.reference },
      { label: "Invoice date", value: lagosDate(order.placedAt) },
      { label: "Fulfilment", value: order.fulfilment === "pickup" ? "Collection" : "Delivery" },
    ],
    lines: invoiceLines(order),
    subtotals: subtotalRows(order),
    total: { label: "Total", amount: formatKoboForDocument(order.totalKobo) },
    terms: terms(settings),
    qr: {
      payload: orderUrl(order),
      caption: "Scan to open this order. You may be asked for the phone number on it.",
    },
    footer: FOOTER_CREDIT,
  };
}

function buildReceipt(
  order: Order,
  settings: Map<SettingKey, SettingValue>,
  payment: PaymentState,
): InvoiceDocument {
  const meta: InvoiceMetaRow[] = [
    { label: "Receipt #", value: order.reference },
    { label: "Order date", value: lagosDate(order.placedAt) },
    { label: "Payment", value: payment.status },
  ];
  if (payment.receivedAt !== null) {
    meta.push({ label: "Received", value: lagosDateTime(payment.receivedAt) });
  }

  return {
    title: "Payment receipt",
    shopName: SHOP_NAME,
    shopLines: shopLines(settings),
    billTo: { heading: "Received from", name: order.contactName, lines: billToLines(order) },
    meta,
    lines: invoiceLines(order),
    subtotals: subtotalRows(order),
    total: { label: payment.totalLabel, amount: formatKoboForDocument(order.totalKobo) },
    terms: terms(settings),
    qr: {
      payload: orderUrl(order),
      caption: "Scan to open this order. You may be asked for the phone number on it.",
    },
    footer: FOOTER_CREDIT,
  };
}

/** Safe in a `Content-Disposition` header and readable in a downloads folder. */
function filenameFor(kind: OrderDocumentKind, reference: string): string {
  const stem = kind === "invoice" ? "Invoice" : "Payment-receipt";
  return `Pouch-Villa-${stem}-${reference.replace(/[^A-Za-z0-9-]/g, "")}.pdf`;
}

/**
 * Renders one of an order's documents. `null` where the order does not exist, so
 * a caller cannot accidentally turn a missing order into a blank invoice.
 */
export async function buildOrderDocument(
  orderId: string,
  kind: OrderDocumentKind,
): Promise<OrderDocumentFile | null> {
  const order = await getOrderById(orderId);
  if (order === null) return null;
  return buildOrderDocumentFor(order, kind);
}

/** The same, for a caller that already holds the order and should not refetch it. */
export async function buildOrderDocumentFor(
  order: Order,
  kind: OrderDocumentKind,
): Promise<OrderDocumentFile> {
  const settings = await readSettings(DOCUMENT_SETTINGS);

  const document =
    kind === "invoice"
      ? buildInvoice(order, settings)
      : buildReceipt(order, settings, await paymentState(order));

  return {
    bytes: await renderInvoicePdf(document),
    filename: filenameFor(kind, order.reference),
    contentType: "application/pdf",
  };
}
