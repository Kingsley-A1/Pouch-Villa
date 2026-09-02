import { queryOne } from "../db/client";
import { sendEmail } from "./email";

/**
 * Telling a reviewer what happened to their review.
 *
 * Anyone may review (Q9), so a review can sit pending for as long as the queue
 * takes and then be published or turned down with nothing said either way. The
 * author who looked for their words on the product page and did not find them
 * has no way to tell which of those happened.
 */

type ReviewRow = {
  author_name: string;
  author_email: string | null;
  product_name: string;
  product_slug: string;
};

/**
 * A review may be left without an email address, in which case there is nobody
 * to write to and this does nothing.
 *
 * The rejection message deliberately carries no moderator note. The reason field
 * is written by staff for staff — it says things like "spam" and "abusive" — and
 * forwarding that to the person who wrote the review turns a quiet moderation
 * decision into an argument.
 */
export async function sendReviewDecisionEmail(
  reviewId: string,
  decision: "approved" | "rejected",
): Promise<void> {
  const review = await queryOne<ReviewRow>(
    `SELECT r.author_name, r.author_email, p.name AS product_name, p.slug AS product_slug
       FROM review r
       JOIN product p ON p.id = r.product_id
      WHERE r.id = $1 AND r.deleted_at IS NULL`,
    [reviewId],
  );
  if (review === null || review.author_email === null) return;

  const published = decision === "approved";

  await sendEmail({
    to: review.author_email,
    subject: published
      ? `Your review of ${review.product_name} is live`
      : `About your review of ${review.product_name}`,
    content: {
      title: published ? "Your review is published" : "Your review was not published",
      preheader: published
        ? `Your review of ${review.product_name} is now on the site.`
        : `Your review of ${review.product_name} was not published.`,
      greeting: `Hello ${review.author_name},`,
      blocks: [
        {
          type: "paragraph",
          text: published
            ? `Thank you for reviewing ${review.product_name}. Your review is now on the product page for other shoppers to read.`
            : `Thank you for taking the time to review ${review.product_name}. We were not able to publish this one.`,
        },
        ...(published
          ? []
          : ([
              {
                type: "paragraph",
                text: "You are welcome to write another. Reviews that describe your own experience with the product are the ones that help other shoppers most.",
              },
            ] as const)),
      ],
      footer: published
        ? "Reply to this message if you would like it taken down."
        : "Reply to this message if you think this was a mistake.",
    },
  });
}
