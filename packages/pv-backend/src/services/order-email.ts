import { formatKobo, kobo } from "../domain/money";
import { describeStatus, type OrderStatus } from "../domain/order-status";
import { queryOne, query } from "../db/client";
import type { EmailBlock } from "./email-template";
import { readSettings, type SettingKey, type SettingValue } from "./settings";
import { sendEmail, sendOperationsEmail, type EmailAttachment } from "./email";
import { buildOrderDocument } from "./order-documents";

/**
 * Transactional email for orders. Business facts come from the settings store,
 * and messages never contain a link that grants access to an order.
 */

const BANK_KEYS: readonly SettingKey[] = [
  "bank.account_name",
  "bank.account_number",
  "bank.bank_name",
];

function present(settings: Map<SettingKey, SettingValue>, key: SettingKey): string | null {
  const value = settings.get(key);
  return value !== undefined && value.present ? value.value : null;
}

type OrderEmailRow = {
  reference: string;
  contact_name: string;
  contact_email: string;
  status: OrderStatus;
  fulfilment: string;
  total_kobo: string;
  delivery_fee_kobo: string;
  subtotal_kobo: string;
};

type LineRow = {
  product_name: string;
  variant_sku: string;
  quantity: string;
  line_total_kobo: string;
};

async function loadOrder(orderId: string) {
  const order = await queryOne<OrderEmailRow>(
    `SELECT reference, contact_name, contact_email, status, fulfilment,
            total_kobo::STRING AS total_kobo,
            delivery_fee_kobo::STRING AS delivery_fee_kobo,
            subtotal_kobo::STRING AS subtotal_kobo
       FROM customer_order WHERE id = $1 AND deleted_at IS NULL`,
    [orderId],
  );
  if (order === null) return null;

  const lines = await query<LineRow>(
    `SELECT product_name, variant_sku, quantity::STRING AS quantity,
            line_total_kobo::STRING AS line_total_kobo
       FROM order_line WHERE order_id = $1 ORDER BY sort_order`,
    [orderId],
  );
  return { order, lines };
}

function orderItems(lines: LineRow[]): EmailBlock {
  return {
    type: "items",
    rows: lines.map((line) => ({
      name: line.product_name,
      meta: `${line.variant_sku} · Qty ${line.quantity}`,
      value: formatKobo(kobo(Number(line.line_total_kobo))),
    })),
  };
}

/**
 * The invoice PDF, or nothing at all.
 *
 * A failure here must not cost the customer their order confirmation. The email
 * carries the items, the total and the transfer details in its own body — the
 * attachment is the convenient copy, not the message — so a rendering fault
 * degrades to an email without a file rather than to no email.
 *
 * Only the error's name is logged. §5 forbids a recipient or a document path
 * reaching a log, and this runs on a path that has both to hand.
 */
async function invoiceAttachment(orderId: string): Promise<EmailAttachment[]> {
  try {
    const document = await buildOrderDocument(orderId, "invoice");
    if (document === null) return [];
    return [
      {
        filename: document.filename,
        content: document.bytes,
        contentType: document.contentType,
      },
    ];
  } catch (error) {
    console.error("Invoice attachment failed", {
      name: error instanceof Error ? error.name : typeof error,
    });
    return [];
  }
}

export async function sendOrderPlacedEmail(orderId: string): Promise<void> {
  const loaded = await loadOrder(orderId);
  if (loaded === null) return;
  const { order, lines } = loaded;

  const settings = await readSettings(BANK_KEYS);
  const accountName = present(settings, "bank.account_name");
  const accountNumber = present(settings, "bank.account_number");
  const bankName = present(settings, "bank.bank_name");
  const bankKnown = accountName !== null && accountNumber !== null && bankName !== null;
  const transferBlocks: EmailBlock[] = bankKnown
    ? [
        { type: "paragraph", text: "Pay by transfer using the details below." },
        {
          type: "details",
          rows: [
            { label: "Account name", value: accountName },
            { label: "Account number", value: accountNumber },
            { label: "Bank", value: bankName },
            { label: "Narration", value: order.reference },
          ],
        },
      ]
    : [{ type: "paragraph", text: "We will send you the transfer details shortly." }];

  const attachments = await invoiceAttachment(orderId);

  await sendEmail({
    to: order.contact_email,
    subject: `Your order ${order.reference}`,
    attachments,
    content: {
      title: "Order received",
      preheader: `We received order ${order.reference}.`,
      greeting: `Hello ${order.contact_name},`,
      blocks: [
        {
          type: "paragraph",
          text: `Thank you for your order. Your reference is ${order.reference}.`,
        },
        orderItems(lines),
        { type: "total", label: "Total", value: formatKobo(kobo(Number(order.total_kobo))) },
        ...transferBlocks,
        {
          type: "paragraph",
          text: "Once you have paid, upload your transfer receipt so we can confirm it.",
        },
        // Said only when it is true. `invoiceAttachment` degrades to nothing
        // rather than failing the send, and an email that points at an
        // attachment which is not there sends the reader looking for a file
        // they will never find.
        ...(attachments.length > 0
          ? [
              {
                type: "paragraph" as const,
                text: "Your invoice is attached to this email as a PDF.",
              },
            ]
          : []),
      ],
      footer: "Keep this email for your records.",
    },
  });
}

/** The payment-received message requested by the client in Q6. */
export async function sendPaymentConfirmedEmail(orderId: string): Promise<void> {
  const loaded = await loadOrder(orderId);
  if (loaded === null) return;
  const { order } = loaded;

  const next =
    order.fulfilment === "pickup"
      ? "We are preparing your order and will let you know as soon as it is ready to collect."
      : "We are preparing your order and will let you know as soon as it is on its way.";

  await sendEmail({
    to: order.contact_email,
    subject: `Payment received for ${order.reference}`,
    content: {
      title: "Payment received",
      preheader: `Payment received for order ${order.reference}.`,
      greeting: `Hello ${order.contact_name},`,
      blocks: [
        {
          type: "paragraph",
          text: "We have received your payment.",
        },
        { type: "details", rows: [{ label: "Order reference", value: order.reference }] },
        { type: "paragraph", text: next },
      ],
      footer: "Keep this email for your records.",
    },
  });
}

/**
 * Sent the moment a transfer receipt lands, before anyone has looked at it.
 *
 * Uploading a receipt is the point in the flow where a customer has already paid
 * and is waiting on a stranger to agree that they did. Silence there is the most
 * expensive silence in the shop: it is what turns into a phone call, and then
 * into a second transfer. This says the file arrived and that a person will
 * check it — nothing more, because nothing more is true yet.
 */
export async function sendProofReceivedEmail(orderId: string): Promise<void> {
  const loaded = await loadOrder(orderId);
  if (loaded === null) return;
  const { order } = loaded;

  await sendEmail({
    to: order.contact_email,
    subject: `We have your receipt for ${order.reference}`,
    content: {
      title: "Receipt received",
      preheader: `Your transfer receipt for ${order.reference} is with us.`,
      greeting: `Hello ${order.contact_name},`,
      blocks: [
        {
          type: "paragraph",
          text: "Your transfer receipt has reached us. Someone will check it against the payment and confirm your order.",
        },
        { type: "details", rows: [{ label: "Order reference", value: order.reference }] },
        {
          type: "paragraph",
          text: "You will get another message as soon as it is confirmed. There is nothing else to do in the meantime.",
        },
      ],
      footer: "Keep this email for your records.",
    },
  });
}

/**
 * Sent when staff cannot accept a receipt.
 *
 * The reason is staff wording aimed at the customer — "the amount does not
 * match", "the photo is too dark to read" — and delivering it is the whole point
 * of collecting it. Without this the order silently returns to awaiting-payment
 * and the customer, who believes they have paid, finds out only if they happen
 * to reopen the tracking page.
 *
 * No transfer details are repeated here: the order confirmation already carried
 * them, and a rejected proof is not a good reason to put an account number in a
 * second mailbox.
 */
export async function sendProofRejectedEmail(orderId: string, reason: string): Promise<void> {
  const loaded = await loadOrder(orderId);
  if (loaded === null) return;
  const { order } = loaded;

  await sendEmail({
    to: order.contact_email,
    subject: `Action needed on order ${order.reference}`,
    content: {
      title: "We could not confirm that receipt",
      preheader: `Your receipt for ${order.reference} could not be confirmed.`,
      greeting: `Hello ${order.contact_name},`,
      blocks: [
        {
          type: "paragraph",
          text: "We looked at the transfer receipt you sent and could not confirm it. Your order is still open and waiting.",
        },
        {
          type: "details",
          rows: [
            { label: "Order reference", value: order.reference },
            { label: "What we found", value: reason },
          ],
        },
        {
          type: "paragraph",
          text: "Open your order and upload the receipt again. If you believe the payment did go through, reply to this message and we will look into it.",
        },
      ],
      footer: "Your order has not been cancelled.",
    },
  });
}

/**
 * Tells the shop that a receipt is waiting.
 *
 * Until now staff learned about a proof only by opening the admin and looking.
 * A customer who has paid is waiting on that glance, so it should not be the
 * thing that has to happen first. Goes to the operations inbox and carries no
 * proof URL — §5 names that specifically.
 */
export async function sendProofAwaitingReviewAlert(orderId: string): Promise<void> {
  const loaded = await loadOrder(orderId);
  if (loaded === null) return;
  const { order } = loaded;

  await sendOperationsEmail({
    subject: `Payment proof to check — ${order.reference}`,
    content: {
      title: "A payment proof is waiting",
      preheader: `Order ${order.reference} has a receipt waiting to be checked.`,
      blocks: [
        {
          type: "details",
          rows: [
            { label: "Order reference", value: order.reference },
            { label: "Customer", value: order.contact_name },
            { label: "Total", value: formatKobo(kobo(Number(order.total_kobo))) },
          ],
        },
        {
          type: "paragraph",
          text: "Open Payments in the admin to view the receipt and confirm or reject it. The receipt itself is only viewable there.",
        },
      ],
    },
  });
}

export async function sendOrderStatusEmail(orderId: string, status: OrderStatus): Promise<void> {
  const loaded = await loadOrder(orderId);
  if (loaded === null) return;
  const { order } = loaded;
  const statusLabel = describeStatus(status);

  await sendEmail({
    to: order.contact_email,
    subject: `Order ${order.reference} — ${statusLabel}`,
    content: {
      title: "Order update",
      preheader: `Order ${order.reference} is now ${statusLabel}.`,
      greeting: `Hello ${order.contact_name},`,
      blocks: [
        {
          type: "details",
          rows: [
            { label: "Order reference", value: order.reference },
            { label: "Status", value: statusLabel },
          ],
        },
      ],
      footer: "Keep this email for your records.",
    },
  });
}
