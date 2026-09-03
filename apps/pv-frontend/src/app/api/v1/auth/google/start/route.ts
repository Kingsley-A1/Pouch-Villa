import { NextResponse, type NextRequest } from "next/server";
import { googleAuthorizeUrl, isGoogleOAuthConfigured } from "@pv/backend/auth/google-oauth";
import {
  callbackUrl,
  newOAuthSecrets,
  safeNext,
  writeOAuthState,
  type OAuthFlow,
} from "@/server/google-oauth-state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Starts a Google sign-in: mints the state and nonce, remembers them in a
 * short-lived cookie, and sends the browser to Google.
 *
 * **A POST, not a link.** The claim flow carries a role code, and a GET would
 * put that credential in the URL bar, the browser's history, and any proxy log
 * between here and Google. A form body keeps it out of all three, and using the
 * same method for all three flows means there is one path to reason about
 * rather than two.
 *
 * It needs no JavaScript. Each sign-in page renders a plain form whose submit
 * button is our own — which is the other half of why the SDK went.
 */

const FLOWS: Record<OAuthFlow, { fallbackNext: string; onError: string }> = {
  customer: { fallbackNext: "/account", onError: "/account/sign-in" },
  staff: { fallbackNext: "/admin", onError: "/admin/login" },
  claim: { fallbackNext: "/admin", onError: "/admin/claim" },
};

function isFlow(value: unknown): value is OAuthFlow {
  return value === "customer" || value === "staff" || value === "claim";
}

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const flowValue = form.get("flow");
  const flow: OAuthFlow = isFlow(flowValue) ? flowValue : "customer";
  const settings = FLOWS[flow];

  if (!isGoogleOAuthConfigured()) {
    // Nothing is configured, so there is nothing to send anyone to. Back to the
    // page they came from with a reason, rather than a redirect into a 400.
    return NextResponse.redirect(
      new URL(`${settings.onError}?google=unavailable`, request.url),
      303,
    );
  }

  const roleCodeValue = form.get("roleCode");
  const roleCode = typeof roleCodeValue === "string" ? roleCodeValue.trim() : "";
  if (flow === "claim" && roleCode === "") {
    return NextResponse.redirect(new URL("/admin/claim?google=nocode", request.url), 303);
  }

  const nextValue = form.get("next");
  const next = safeNext(typeof nextValue === "string" ? nextValue : null, settings.fallbackNext);

  const { state, nonce } = newOAuthSecrets();
  await writeOAuthState({
    state,
    nonce,
    flow,
    next,
    ...(flow === "claim" ? { roleCode } : {}),
  });

  const authorize = googleAuthorizeUrl({
    redirectUri: await callbackUrl(),
    state,
    nonce,
  });

  // 303, so the browser follows with a GET. A 307 would repeat the POST at
  // Google, which is not what its authorization endpoint expects.
  return NextResponse.redirect(authorize, 303);
}
