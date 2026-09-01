import { formatKobo, kobo } from "../domain/money";
import { describeStatus, type OrderStatus } from "../domain/order-status";
import { queryOne, query } from "../db/client";
import { readSettings, type SettingKey, type SettingValue } from "./settings";
import { sendEmail } from "./email";

/**
 * Transactional email for orders.
 *
 * Two rules shape every line of copy here:
 *
 *   §4  **No hardcoded business facts.** Not the shop's address, not its phone
 *       number, not its bank details. Everything factual is read from the
 *       settings store, and an unset setting is simply omitted rather than
 *       rendered as a blank line where an account number should be.
 *   §5  **Nothing security-bearing is sent by email.** ADR 0002 makes the
 *       customer's address unverified and therefore not an identity proof, so
 *       these messages carry no link that grants access to anything. The order
 *       reference is in them; tracking still requires the phone as well.
 *
 * Sending is always best-effort at the call site. An order is placed whether or
 * not Resend is reachable, and a failed send must never roll one back.
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

/** Minimal escaping, because every value below is customer- or staff-supplied. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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

function renderLines(lines: LineRow[]): { html: string; text: string } {
  const html = lines
    .map(
      (line) =>
        `<tr><td style="padding:4px 8px 4px 0">${escapeHtml(line.product_name)} × ${escapeHtml(
          line.quantity,
        )}</td><td style="padding:4px 0;text-align:right">${formatKobo(
          kobo(Number(line.line_total_kobo)),
        )}</td></tr>`,
    )
    .join("");
  const text = lines
    .map(
      (line) =>
        `  ${line.product_name} x${line.quantity}  ${formatKobo(kobo(Number(line.line_total_kobo)))}`,
    )
    .join("\n");
  return { html, text };
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

  const rendered = renderLines(lines);
  const total = formatKobo(kobo(Number(order.total_kobo)));

  /**
   * Where the bank details are not yet configured the email says so plainly
   * instead of printing an empty box. §0 rule 2: a plausible blank that reaches
   * a customer is worse than an honest absence.
   */
  const transferHtml = bankKnown
    ? `<p><strong>Pay by transfer</strong><br>
       ${escapeHtml(accountName)}<br>
       ${escapeHtml(accountNumber)}<br>
       ${escapeHtml(bankName)}<br>
       Use <strong>${escapeHtml(order.reference)}</strong> as the transfer narration.</p>`
    : `<p>We will send you the transfer details shortly.</p>`;

  const transferText = bankKnown
    ? `Pay by transfer\n  ${accountName}\n  ${accountNumber}\n  ${bankName}\n  Use ${order.reference} as the transfer narration.`
    : "We will send you the transfer details shortly.";

  await sendEmail({
    to: order.contact_email,
    subject: `Your order ${order.reference}`,
    html: `<p>Hello ${escapeHtml(order.contact_name)},</p>
      <p>Thank you for your order. Your reference is <strong>${escapeHtml(order.reference)}</strong>.</p>
      <table>${rendered.html}
        <tr><td style="padding-top:8px"><strong>Total</strong></td>
            <td style="padding-top:8px;text-align:right"><strong>${total}</strong></td></tr>
      </table>
      ${transferHtml}
      <p>Once you have paid, upload your transfer receipt so we can confirm it.</p>`,
    text: `Hello ${order.contact_name},

Thank you for your order. Your reference is ${order.reference}.

${rendered.text}
  Total  ${total}

${transferText}

Once you have paid, upload your transfer receipt so we can confirm it.`,
  });
}

/**
 * The message the client asked for by name in Q6 — _"user gets Email
 * notification that payment is received"_.
 */
export async function sendPaymentConfirmedEmail(orderId: string): Promise<void> {
  const loaded = await loadOrder(orderId);
  if (loaded === null) return;
  const { order } = loaded;

  const collecting = order.fulfilment === "pickup";
  const next = collecting
    ? "We are preparing your order and will let you know as soon as it is ready to collect."
    : "We are preparing your order and will let you know as soon as it is on its way.";

  await sendEmail({
    to: order.contact_email,
    subject: `Payment received for ${order.reference}`,
    html: `<p>Hello ${escapeHtml(order.contact_name)},</p>
      <p>We have received your payment for order <strong>${escapeHtml(order.reference)}</strong>.</p>
      <p>${next}</p>`,
    text: `Hello ${order.contact_name},

We have received your payment for order ${order.reference}.

${next}`,
  });
}

export async function sendOrderStatusEmail(orderId: string, status: OrderStatus): Promise<void> {
  const loaded = await loadOrder(orderId);
  if (loaded === null) return;
  const { order } = loaded;

  await sendEmail({
    to: order.contact_email,
    subject: `Order ${order.reference} — ${describeStatus(status)}`,
    html: `<p>Hello ${escapeHtml(order.contact_name)},</p>
      <p>Your order <strong>${escapeHtml(order.reference)}</strong> is now:
         ${escapeHtml(describeStatus(status))}.</p>`,
    text: `Hello ${order.contact_name},

Your order ${order.reference} is now: ${describeStatus(status)}.`,
  });
}

/**
 * The password-reset code. Deliberately code-based rather than a link, on ADR
 * 0002's reasoning: a magic link leaks through shared inboxes and forwarded
 * mail, breaks in in-app browsers, and is phishable in a way a code typed into
 * a page the user already has open is not.
 */
export async function sendPasswordResetEmail(email: string, code: string): Promise<void> {
  await sendEmail({
    to: email,
    subject: "Your Pouch Villa password reset code",
    html: `<p>Your password reset code is <strong style="font-size:20px;letter-spacing:2px">${escapeHtml(
      code,
    )}</strong>.</p>
      <p>It expires in 15 minutes. If you did not ask to reset your password, you can ignore this message.</p>`,
    text: `Your password reset code is ${code}.

It expires in 15 minutes. If you did not ask to reset your password, you can ignore this message.`,
  });
}
