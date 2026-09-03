/**
 * What a failed Google sign-in says, read from the `?google=` reason the
 * callback route redirects back with.
 *
 * The SDK reported failures through an in-page callback. A redirect flow has no
 * such callback — the browser leaves the site and comes back — so the outcome
 * travels in the URL and every sign-in page renders it here.
 *
 * The wording is deliberately uniform across the two that matter. "No staff
 * account for that Google address" and "that account is suspended" are different
 * facts, and telling them apart would let anyone who can reach the URL discover
 * which addresses have accounts. The server log keeps the distinction; the
 * person gets one message and a way forward.
 */

const REASONS: Record<string, string> = {
  cancelled: "That sign-in was cancelled. Nothing has changed.",
  expired: "That sign-in took too long. Please start again.",
  mismatch: "That sign-in could not be matched to this browser. Please start again.",
  failed: "That Google sign-in could not be completed. Try again, or use your password.",
  unavailable: "Google sign-in is not configured. Please use your password.",
  nocode: "Enter your role code first, then continue with Google.",
  unverified: "That Google account's email address is not verified.",
  claimfailed: "That account could not be created. Check your role code and try again.",
};

export function GoogleSignInProblem({ reason }: { reason: string | undefined }) {
  const message = reason === undefined ? undefined : REASONS[reason];
  if (message === undefined) return null;

  return (
    <p
      role="alert"
      className="rounded-xl border border-[color-mix(in_srgb,var(--pv-danger)_35%,var(--pv-line))] bg-[color-mix(in_srgb,var(--pv-danger)_10%,var(--pv-surface))] px-4 py-3 text-sm text-(--pv-danger)"
    >
      {message}
    </p>
  );
}

/** Narrows a raw search param to the single string these pages expect. */
export function googleReason(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}
