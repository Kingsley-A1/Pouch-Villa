import { renderTransactionalEmail, type TransactionalEmailInput } from "./email-template";

/**
 * Thin Resend wrapper. There is no local fallback that pretends to send mail: if
 * RESEND_API_KEY is configured, a send failure is a real error the caller must
 * handle; if it is not configured, sending is refused outright rather than
 * silently discarding the message; a plain HTTP failure raises the response body.
 */

export class EmailNotConfiguredError extends Error {
  constructor() {
    super("RESEND_API_KEY is not configured.");
    this.name = "EmailNotConfiguredError";
  }
}

/**
 * A file to travel with the message.
 *
 * Bytes rather than a link, and deliberately so for the one thing that uses it:
 * a customer's invoice. A link would have to be either public — a document with
 * a name and an address on it, readable by anyone who guessed the URL — or
 * authorised, which means the person who most wants to keep the file has to sign
 * in to get it. An attachment is neither. It arrives with the message, it works
 * offline, and it is the shape a receipt has taken since before email.
 */
export type EmailAttachment = {
  filename: string;
  content: Uint8Array;
  contentType: string;
};

export type SendEmailInput = {
  to: string;
  subject: string;
  content: Omit<TransactionalEmailInput, "brandName">;
  attachments?: readonly EmailAttachment[];
};

/**
 * Where operational alerts go — a new enquiry, a payment proof waiting to be
 * checked — when there is no customer to address.
 *
 * Infrastructure, not a business fact: it is the shop's own operations inbox and
 * it sits with the sending identity in `.env`, alongside the from-address whose
 * domain Resend has to verify. The customer-facing contact address is a separate,
 * admin-managed setting and this is not it (AGENTS.md §4).
 *
 * `null` when unset, so a shop that has not configured one simply gets no
 * alerts. Failing an enquiry submission because nobody set an env var would
 * punish the customer for the deployment's omission.
 */
export function operationsInbox(): string | null {
  const address = process.env.RESEND_EMAIL_SEND_TO?.trim();
  return address ? address : null;
}

/**
 * An alert to the shop's own inbox. Silently does nothing when no inbox is
 * configured — see `operationsInbox`.
 */
export async function sendOperationsEmail(input: Omit<SendEmailInput, "to">): Promise<void> {
  const to = operationsInbox();
  if (to === null) return;
  await sendEmail({ ...input, to });
}

export async function sendEmail(input: SendEmailInput): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromAddress = process.env.RESEND_EMAIL_SEND_FROM;
  const fromName = process.env.RESEND_EMAIL_SEND_FROM_NAME;
  if (!apiKey || !fromAddress) throw new EmailNotConfiguredError();
  const rendered = renderTransactionalEmail({
    ...input.content,
    brandName: fromName?.trim() || fromAddress,
  });

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromName ? `${fromName} <${fromAddress}>` : fromAddress,
      to: [input.to],
      subject: input.subject,
      html: rendered.html,
      text: rendered.text,
      // Omitted entirely when there is nothing to attach: Resend rejects an
      // empty `attachments` array rather than treating it as none.
      ...(input.attachments && input.attachments.length > 0
        ? {
            attachments: input.attachments.map((attachment) => ({
              filename: attachment.filename,
              content: Buffer.from(attachment.content).toString("base64"),
              content_type: attachment.contentType,
            })),
          }
        : {}),
    }),
  });

  if (!response.ok) {
    // Never put the recipient or a token in an error message that might reach a
    // log — this reports only that sending failed, not to whom or with what.
    throw new Error(`Email send failed with status ${response.status}.`);
  }
}
