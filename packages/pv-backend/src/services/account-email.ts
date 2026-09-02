import { greetingName } from "../domain/person-name";
import { sendEmail } from "./email";

/**
 * Transactional email about a customer's account, as opposed to their orders.
 *
 * Split from `order-email.ts` because these are sent to a person about their
 * identity, not to a buyer about a purchase — different triggers, different
 * recipients, and different reasons to change. The password-reset code moved
 * here for the same reason: it never had anything to do with an order.
 *
 * Nothing here contains a link that signs anyone in. Per ADR 0002 recovery is a
 * typed code, and a magic link in a mailbox is exactly the credential these
 * messages must not become.
 */

/**
 * Sent once, when an account is created.
 *
 * Deliberately not a verification step — ADR 0002 removed the inbox round-trip
 * on purpose and nothing here reinstates it; the account already works. What it
 * does do is give a mistyped address somewhere to fail visibly, and put the
 * shop's name in a mailbox the customer can search later when they are trying to
 * remember where they ordered from.
 */
export async function sendWelcomeEmail(email: string, fullName: string | null): Promise<void> {
  const name = greetingName(fullName, email);

  await sendEmail({
    to: email,
    subject: "Welcome to Pouch Villa",
    content: {
      title: "Your account is ready",
      preheader: "Your Pouch Villa account is ready to use.",
      ...(name === null ? {} : { greeting: `Hello ${name},` }),
      blocks: [
        {
          type: "paragraph",
          text: "Thank you for creating an account. You can order, track every order from one place, and keep the products you like.",
        },
        {
          type: "paragraph",
          text: "There is nothing to confirm — your account already works. Sign in whenever you are ready.",
        },
      ],
      footer: "If you did not create this account, reply to this message and we will remove it.",
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

/**
 * Sent after a password actually changes, by either route.
 *
 * This is the one message that has to go out even though it tells the customer
 * something they already know. It is how the owner of an account finds out that
 * somebody else changed the password — and because a change also ends every
 * other session, it is how they learn why they were signed out.
 *
 * It names no password, no code and no session, and it offers no link back in:
 * an attacker who has the mailbox must gain nothing from receiving it.
 */
export async function sendPasswordChangedEmail(
  email: string,
  fullName: string | null = null,
): Promise<void> {
  const name = greetingName(fullName, email);

  await sendEmail({
    to: email,
    subject: "Your Pouch Villa password was changed",
    content: {
      title: "Your password was changed",
      preheader: "The password on your Pouch Villa account has just been changed.",
      ...(name === null ? {} : { greeting: `Hello ${name},` }),
      blocks: [
        {
          type: "paragraph",
          text: "The password on your account has just been changed, and every device that was signed in has been signed out.",
        },
        {
          type: "paragraph",
          text: "If that was you, there is nothing to do. If it was not, reply to this message straight away — someone else has access to your account.",
        },
      ],
      footer: "We will never ask you for your password by email.",
    },
  });
}
