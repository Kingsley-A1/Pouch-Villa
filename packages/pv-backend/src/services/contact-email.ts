import { queryOne } from "../db/client";
import { sendEmail, sendOperationsEmail } from "./email";

/**
 * Email for contact enquiries — scope item 12.
 *
 * The enquiry was already being recorded; what was missing was anyone being
 * told. Neither side of that is optional: a customer who gets no acknowledgement
 * assumes the form is broken and phones instead, and staff who get no alert only
 * see the enquiry when they next open the admin.
 */

type EnquiryRow = {
  name: string;
  email: string | null;
  phone: string | null;
  subject: string | null;
  message: string;
  order_reference: string | null;
};

async function loadEnquiry(enquiryId: string): Promise<EnquiryRow | null> {
  return queryOne<EnquiryRow>(
    `SELECT name, email, phone, subject, message, order_reference
       FROM contact_request WHERE id = $1 AND deleted_at IS NULL`,
    [enquiryId],
  );
}

/**
 * Confirms to the sender that their message arrived.
 *
 * An enquiry may be left with a phone number and no email — the service requires
 * one or the other — in which case there is nobody to write to and this does
 * nothing. Their own message is quoted back so the acknowledgement is evidence
 * of what was actually received, not just that something was.
 */
export async function sendEnquiryReceivedEmail(enquiryId: string): Promise<void> {
  const enquiry = await loadEnquiry(enquiryId);
  if (enquiry === null || enquiry.email === null) return;

  await sendEmail({
    to: enquiry.email,
    subject: "We have your message",
    content: {
      title: "Message received",
      preheader: "Your message has reached Pouch Villa.",
      greeting: `Hello ${enquiry.name},`,
      blocks: [
        {
          type: "paragraph",
          text: "Thank you for getting in touch. Your message has reached us and someone will reply.",
        },
        {
          type: "details",
          rows: [
            ...(enquiry.subject === null
              ? []
              : [{ label: "Subject", value: enquiry.subject } as const]),
            ...(enquiry.order_reference === null
              ? []
              : [{ label: "Order reference", value: enquiry.order_reference } as const]),
          ],
        },
        { type: "paragraph", text: `You wrote: “${enquiry.message}”` },
      ],
      footer: "Reply to this message if you have anything to add.",
    },
  });
}

/**
 * Tells the shop an enquiry is waiting, with enough in it to answer from a phone
 * without opening the admin first.
 *
 * The customer's own contact details are in here because they are what makes the
 * alert useful, and because this goes only to the shop's operations inbox —
 * never onward.
 */
export async function sendEnquiryAlert(enquiryId: string): Promise<void> {
  const enquiry = await loadEnquiry(enquiryId);
  if (enquiry === null) return;

  await sendOperationsEmail({
    subject: `New enquiry from ${enquiry.name}`,
    content: {
      title: "New enquiry",
      preheader: enquiry.subject ?? `${enquiry.name} has sent a message.`,
      blocks: [
        {
          type: "details",
          rows: [
            { label: "From", value: enquiry.name },
            ...(enquiry.email === null ? [] : [{ label: "Email", value: enquiry.email } as const]),
            ...(enquiry.phone === null ? [] : [{ label: "Phone", value: enquiry.phone } as const]),
            ...(enquiry.subject === null
              ? []
              : [{ label: "Subject", value: enquiry.subject } as const]),
            ...(enquiry.order_reference === null
              ? []
              : [{ label: "Order reference", value: enquiry.order_reference } as const]),
          ],
        },
        { type: "paragraph", text: enquiry.message },
        {
          type: "paragraph",
          text: "Open Contact in the admin to mark it in progress or closed once you have replied.",
        },
      ],
    },
  });
}
