/**
 * Whether a CEO redemption must match the pinned bootstrap address.
 *
 * A pure decision, deliberately separated from the transaction that acts on it.
 * The rule it encodes is a security control, and the integration test that
 * covered it needs a database — which neither CI nor a contributor's machine
 * reliably has, so in practice it skipped and the rule was never actually
 * asserted anywhere. Extracted, it is exercised on every run.
 *
 * The rule: `BOOTSTRAP_CEO_EMAIL` protects exactly one code — the first CEO
 * code, minted from a command line before anybody can sign in, printed to a
 * terminal and possibly a log. Pinning it to one mailbox means seeing that code
 * is not by itself enough to become CEO.
 *
 * Once a CEO exists the pin has nothing left to protect: a CEO code can only
 * have been minted by a signed-in CEO through the admin, which needs a live
 * session and the staff permission and writes an audit record naming who issued
 * it. Applying it forever instead meant the shop could only ever have the one
 * CEO whose address sat in an environment variable.
 */
export function ceoRedemptionIsPinnedOut({
  role,
  pinnedEmail,
  redeemingEmail,
  ceoExists,
}: {
  role: string;
  /** `BOOTSTRAP_CEO_EMAIL`, already trimmed and lowercased, or absent. */
  pinnedEmail: string | undefined;
  /** The address claiming the code, already trimmed and lowercased. */
  redeemingEmail: string;
  /** Whether any active, undeleted CEO account exists. */
  ceoExists: boolean;
}): boolean {
  if (role !== "CEO") return false;
  // No pin configured is a deployment that never asked for one.
  if (!pinnedEmail) return false;
  // Past bootstrap. The admin is the control now.
  if (ceoExists) return false;
  return pinnedEmail !== redeemingEmail;
}
