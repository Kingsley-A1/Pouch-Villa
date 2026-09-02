import { firstName } from "../domain/person-name";
import { sendEmail } from "./email";

/**
 * Telling a staff member that their access changed, in the CEO's own words.
 *
 * This is the answer to Q11. It was deliberately left unbuilt in ADR 0008,
 * because "should we email someone we have just suspended, and what should it
 * say" is a decision about how Pouch Villa parts with people rather than an
 * engineering gap. The client's answer: yes, and the CEO writes it at the moment
 * they make the change.
 *
 * So the wording is a parameter, not a template. What this module owns is the
 * envelope — the subject, the shape, and the guarantee about what a message of
 * this kind may not contain.
 *
 * ## What it may not carry
 *
 * A suspension notice reaches a mailbox that may no longer belong to someone the
 * business trusts. So it carries no sign-in link, no code, no session
 * information, and nothing about anyone else's account. Reactivation carries no
 * credential either: an account that is active again is reached by signing in
 * the ordinary way, and a link that did more than that would be a way back in
 * that outlives the mailbox.
 *
 * The CEO's message is escaped by the template renderer like any other value, so
 * typed markup lands as text rather than markup.
 */
export async function sendStaffAccessChangedEmail(
  email: string,
  fullName: string,
  status: "active" | "suspended",
  /** The CEO's message. Callers pass `null` when they chose not to write one. */
  message: string | null,
): Promise<void> {
  const suspended = status === "suspended";
  const name = firstName(fullName);

  await sendEmail({
    to: email,
    subject: suspended
      ? "Your Pouch Villa staff access has been suspended"
      : "Your Pouch Villa staff access has been restored",
    content: {
      title: suspended ? "Your access has been suspended" : "Your access has been restored",
      preheader: suspended
        ? "Your Pouch Villa staff access has been suspended."
        : "You can sign in to the Pouch Villa admin again.",
      ...(name === null ? {} : { greeting: `Hello ${name},` }),
      blocks: [
        {
          type: "paragraph",
          text: suspended
            ? "Your access to the Pouch Villa admin has been suspended, and any sessions you had open have ended."
            : "Your access to the Pouch Villa admin has been restored. You can sign in again as usual.",
        },
        // The CEO's own words, kept as a separate paragraph so it is clear which
        // part of this message is a person writing and which is the system.
        ...(message === null ? [] : ([{ type: "paragraph", text: message }] as const)),
      ],
      // No link and no code, deliberately — see the note above.
      footer: suspended
        ? "If you believe this is a mistake, reply to this message."
        : "If you did not expect this, reply to this message.",
    },
  });
}
