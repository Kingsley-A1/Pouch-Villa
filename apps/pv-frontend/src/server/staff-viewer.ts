import { getStaffPrincipal } from "./session";

/**
 * Whether the person looking at the storefront happens to be signed into the
 * admin — and nothing else about them.
 *
 * **This exists because of a rule, not in spite of one.** AGENTS.md §5 keeps
 * customers and staff in separate tables, cookies, sessions and code paths, so
 * that a privilege bug in the storefront cannot reach the admin. That is why the
 * CEO, signed into the admin, opens the shop and is met by a "Sign in" prompt:
 * the storefront has no idea who they are, by design, and they read that as the
 * site having logged them out.
 *
 * The fix is recognition, not identity. This returns a **display name string**,
 * never a `StaffPrincipal`. That is the whole safety argument and it is why the
 * narrowing happens here rather than at the call site: a name cannot be used to
 * authorise anything. There is no staff id to look a permission up with, no role
 * to branch on, and no session object for a future edit to start trusting. The
 * worst a bug in storefront code can do with the return value of this function
 * is print it.
 *
 * What it deliberately does not do: it does not sign anyone in, does not create
 * or merge a customer session, does not attach a cart or an order history, and
 * does not let a staff member act as a customer. A staff member who wants to buy
 * something signs into their own customer account, which is a different identity
 * and should stay one.
 *
 * The fuller reading of the client's request — one sign-in producing both
 * sessions — is a real change to the security posture and is theirs to decide.
 * See `docs/decisions/0014-staff-visibility-on-the-storefront.md` and
 * `docs/open-questions.md` Q12.
 *
 * Costs a shopper nothing: with no staff cookie on the request this returns at
 * the cookie read, before any query.
 */
export async function staffViewerName(): Promise<string | null> {
  const principal = await getStaffPrincipal();
  return principal === null ? null : principal.fullName;
}
