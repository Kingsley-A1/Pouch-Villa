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

export type SendEmailInput = {
  to: string;
  subject: string;
  content: Omit<TransactionalEmailInput, "brandName">;
};

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
    }),
  });

  if (!response.ok) {
    // Never put the recipient or a token in an error message that might reach a
    // log — this reports only that sending failed, not to whom or with what.
    throw new Error(`Email send failed with status ${response.status}.`);
  }
}
