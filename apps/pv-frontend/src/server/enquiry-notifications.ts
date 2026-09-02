import { sendEnquiryAlert, sendEnquiryReceivedEmail } from "@pv/backend/services/contact-email";
import { dispatchEmail } from "./notify";

/**
 * Both sides of an enquiry, in one call.
 *
 * An enquiry arrives through two doors — the contact form's Server Action and
 * `api/v1/contact` — and both owe the same two messages. Keeping the pair here
 * is what stops one door acquiring a customer acknowledgement and the other
 * quietly not.
 *
 * Fired after the enquiry is committed, and never awaited: a customer who has
 * written to us has done their part, and a mail provider being unreachable must
 * not turn that into an error on their screen.
 */
export function notifyEnquiry(enquiryId: string): void {
  dispatchEmail("Enquiry acknowledgement", sendEnquiryReceivedEmail(enquiryId));
  dispatchEmail("Enquiry alert", sendEnquiryAlert(enquiryId));
}
