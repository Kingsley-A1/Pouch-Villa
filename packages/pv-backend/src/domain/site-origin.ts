/**
 * Where this deployment lives, as an absolute origin.
 *
 * Two callers need it and they used to have only one between them. The
 * storefront resolved it in `lib/seo.ts` for canonical URLs and the OpenGraph
 * card; the email templates could not reach that — a backend module may not
 * import from the app — and so had no way to build an absolute image URL. An
 * email has no page to be relative to, so every asset in one must be absolute.
 *
 * The variable names are the frontend's because they are the ones already set on
 * every deployment. Asking the client to configure a second name for the same
 * fact is how two sources of truth start.
 *
 * A function rather than a constant: a module-level constant is read once at
 * import, which in a long-lived server process means a value captured before the
 * environment was fully assembled, and it cannot be varied by a test.
 *
 * This is infrastructure, not a business fact (AGENTS.md §4) — which host we are
 * is not something a staff member edits in the admin.
 */

const DEVELOPMENT_ORIGIN = "http://localhost:3000";

/** Accepts a bare hostname as well as a full URL, because Vercel supplies both shapes. */
function asHttpOrigin(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withProtocol);
    return url.protocol === "http:" || url.protocol === "https:" ? url.origin : undefined;
  } catch {
    return undefined;
  }
}

export function siteOrigin(): string {
  return (
    asHttpOrigin(process.env.NEXT_PUBLIC_SITE_URL) ||
    asHttpOrigin(process.env.VERCEL_PROJECT_PRODUCTION_URL) ||
    asHttpOrigin(process.env.VERCEL_URL) ||
    DEVELOPMENT_ORIGIN
  );
}

/** An absolute URL for a path on this deployment. */
export function absoluteSiteUrl(path: string): string {
  return new URL(path, siteOrigin()).toString();
}
