import { formatKobo, kobo } from "../domain/money";
import { describeStatus, type OrderStatus } from "../domain/order-status";
import { queryOne, query } from "../db/client";
import type { EmailBlock } from "./email-template";
import { readSettings, type SettingKey, type SettingValue } from "./settings";
import { sendEmail } from "./email";

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

  await sendEmail({
    to: order.contact_email,
    subject: `Your order ${order.reference}`,
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

/** The reset code remains code-based rather than becoming a magic link. */
export async function sendPasswordResetEmail(email: string, code: string): Promise<void> {
  await sendEmail({
    to: email,
    subject: "Your Pouch Villa password reset code",
    content: {
      title: "Reset your password",
      preheader: "Your password reset code expires in 15 minutes.",
      blocks: [
        {
          type: "code",
          label: "Password reset code",
          value: code,
          hint: "This code expires in 15 minutes.",
        },
      ],
      footer: "If you did not ask to reset your password, you can ignore this message.",
    },
  });
}
