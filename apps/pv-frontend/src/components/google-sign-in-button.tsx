/**
 * "Continue with Google", as our own button.
 *
 * A Server Component that renders a plain form. No JavaScript, no third-party
 * script, and nothing injected into the page by anybody else — which is the
 * whole reason it exists. Google's own widget built its button with inline
 * styles that a strict Content Security Policy cannot authorise, so under §5's
 * no-`unsafe-inline` rule it rendered as a 448px logo. See
 * `auth/google-oauth.ts` for the full account.
 *
 * The mark is Google's, drawn inline at a fixed 18px. Google's branding
 * guidelines ask for the four-colour "G" on a white or neutral field with the
 * words "Continue with Google", which is what this is; the surrounding button
 * takes our own border, radius and focus ring so it sits with the rest of the
 * form rather than beside it.
 *
 * A `<button>` inside a `<form>`, so it works before hydration and with
 * JavaScript disabled. `formAction` is not used: the action is on the form, and
 * `form-action 'self'` in the policy permits exactly this.
 */

function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" focusable="false" className="h-[18px] w-[18px]">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

export function GoogleSignInButton({
  flow,
  next,
  roleCode,
  label = "Continue with Google",
}: {
  flow: "customer" | "staff" | "claim";
  /** Where to land after signing in. Re-validated server-side as a same-site path. */
  next?: string;
  /**
   * The claim flow only. Rendered as a hidden field so the code typed above
   * travels in the request body rather than the URL — see
   * `server/google-oauth-state.ts` for why that matters.
   */
  roleCode?: string;
  label?: string;
}) {
  return (
    <form method="POST" action="/api/v1/auth/google/start" className="w-full">
      <input type="hidden" name="flow" value={flow} />
      {next === undefined ? null : <input type="hidden" name="next" value={next} />}
      {roleCode === undefined ? null : <input type="hidden" name="roleCode" value={roleCode} />}
      <button
        type="submit"
        className={[
          "flex min-h-11 w-full items-center justify-center gap-3 rounded-xl px-4",
          "border border-(--pv-line) bg-(--pv-surface) text-sm font-bold text-(--pv-ink)",
          "transition-colors hover:bg-(--pv-wash)",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--pv-red)",
        ].join(" ")}
      >
        <GoogleMark />
        {label}
      </button>
    </form>
  );
}
