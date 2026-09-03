import { NextResponse, type NextRequest } from "next/server";
import { exchangeCodeForIdToken } from "@pv/backend/auth/google-oauth";
import { verifyGoogleIdToken } from "@pv/backend/auth/google";
import { loginCustomerWithGoogle } from "@pv/backend/services/customer-account";
import { loginWithGoogle } from "@pv/backend/services/staff-login";
import { redeemRoleCode } from "@pv/backend/services/staff-access";
import { requestContext } from "@/server/api";
import { establishCustomerSession } from "@/server/customer-session";
import { createStaffSession } from "@/server/session";
import {
  callbackUrl,
  clearOAuthState,
  readOAuthState,
  statesMatch,
  type OAuthFlow,
} from "@/server/google-oauth-state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Where Google sends the browser back, and the only place a Google sign-in
 * becomes a session.
 *
 * The order of checks is the point of this file. Nothing is trusted until the
 * state matches a cookie this browser was given, and the ID token is verified
 * against Google's published keys with the nonce we minted — so neither an
 * authorization code an attacker obtained elsewhere nor a token from some other
 * flow can be walked in through here.
 *
 * The three flows land in exactly the services they always did.
 * `loginCustomerWithGoogle` resolves against `customer`, `loginWithGoogle`
 * against `staff`, and `redeemRoleCode` still requires a code. ADR 0002 holds:
 * the two identity stacks share no session, no cookie and no table, and this
 * route is the one place both are reachable — which is why the flow is read from
 * the cookie rather than from anything in the URL.
 */

const ERROR_PAGE: Record<OAuthFlow, string> = {
  customer: "/account/sign-in",
  staff: "/admin/login",
  claim: "/admin/claim",
};

function back(request: NextRequest, page: string, reason: string) {
  return NextResponse.redirect(new URL(`${page}?google=${reason}`, request.url), 303);
}

/** `next` is already validated as a same-site path by the time this is called. */
function welcomePath(next: string): string {
  return next === "/account"
    ? "/account/welcome"
    : `/account/welcome?next=${encodeURIComponent(next)}`;
}

export async function GET(request: NextRequest) {
  const saved = await readOAuthState();
  // Single use, whatever happens next. A state left in the browser is one that
  // could be presented a second time.
  await clearOAuthState();

  if (saved === null) {
    return back(request, "/account/sign-in", "expired");
  }

  const page = ERROR_PAGE[saved.flow];
  const params = request.nextUrl.searchParams;

  // Google reports a refusal in the URL — most often the person pressing cancel.
  if (params.get("error") !== null) {
    return back(request, page, "cancelled");
  }

  if (!statesMatch(saved.state, params.get("state"))) {
    return back(request, page, "mismatch");
  }

  const code = params.get("code");
  if (code === null) return back(request, page, "failed");

  const context = await requestContext();
  /*
    Rebuilt rather than passed through. `RequestContext` types its optional
    fields as `string | undefined`, and the services type theirs as `string?`;
    under `exactOptionalPropertyTypes` those are different, and an absent key is
    what the services actually want. Spreading only what is set says that.
  */
  const audit = {
    ...(context.ip === undefined ? {} : { ip: context.ip }),
    requestId: context.requestId,
  };

  try {
    const idToken = await exchangeCodeForIdToken(code, await callbackUrl());
    const identity = await verifyGoogleIdToken(idToken, saved.nonce);

    if (saved.flow === "customer") {
      const { customerId, created } = await loginCustomerWithGoogle(idToken, audit);
      await establishCustomerSession(customerId);
      /*
        Signing in with Google is one tap, so nothing on screen otherwise
        distinguishes "you now have an account" from "you were already a
        member". A returning customer goes straight on; only a new one is
        welcomed. Carried over from the action this route replaced — it would
        have been quietly lost otherwise.
      */
      return NextResponse.redirect(
        new URL(created ? welcomePath(saved.next) : saved.next, request.url),
        303,
      );
    }

    if (saved.flow === "staff") {
      const { staffId } = await loginWithGoogle(idToken, audit);
      await createStaffSession(staffId);
      return NextResponse.redirect(new URL(saved.next, request.url), 303);
    }

    // Claim. A Google account proves a mailbox; the role code is what creates
    // the account and sets the role, and it is still required here.
    if (saved.roleCode === undefined) return back(request, page, "nocode");
    if (!identity.emailVerified) return back(request, page, "unverified");

    const { staffId } = await redeemRoleCode(
      {
        code: saved.roleCode,
        email: identity.email,
        fullName: identity.fullName ?? identity.email.split("@")[0] ?? "Staff member",
        googleSubject: identity.subject,
      },
      audit,
    );
    await createStaffSession(staffId);
    return NextResponse.redirect(new URL(saved.next, request.url), 303);
  } catch (error) {
    /*
      One generic outcome per flow, and the reason only in the server log.

      A message that distinguished "no staff account for that Google address"
      from "that account is suspended" would answer, for anybody who can reach
      this URL, which addresses have accounts here. The error's *name* is safe to
      log; its message can carry an email, and §5 forbids that reaching a log.
    */
    console.error("Google sign-in failed", {
      flow: saved.flow,
      name: error instanceof Error ? error.name : typeof error,
    });
    return back(request, page, saved.flow === "claim" ? "claimfailed" : "failed");
  }
}
