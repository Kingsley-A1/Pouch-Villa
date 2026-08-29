/**
 * One place decides whether a deployment may be indexed.
 *
 * The prototype set `index: false` in the root metadata and nowhere else, so the
 * whole site would have shipped to production invisible to search engines. Indexing
 * is now opt-in per environment: staging and preview stay out of the index by
 * default, and production has to say so explicitly.
 *
 * This is infrastructure, not a business fact — which host we are is not something
 * a staff member edits in the admin.
 */

const DEVELOPMENT_ORIGIN = "http://localhost:3000";

export const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL &&
    `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`) ||
  (process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`) ||
  DEVELOPMENT_ORIGIN;

export const isIndexable = process.env.NEXT_PUBLIC_SITE_INDEXABLE === "true";

export function absoluteUrl(path: string) {
  return new URL(path, siteUrl).toString();
}

/**
 * Public routes that always exist. Product and category URLs join the sitemap in
 * Phase 2, once the catalogue holds real client data — listing fictional seed
 * products would ask search engines to index things that do not exist.
 */
export const staticRoutes = [
  { path: "/", changeFrequency: "weekly", priority: 1 },
  { path: "/shop", changeFrequency: "daily", priority: 0.9 },
  { path: "/collections", changeFrequency: "weekly", priority: 0.7 },
  { path: "/help", changeFrequency: "monthly", priority: 0.5 },
  { path: "/visit-us", changeFrequency: "monthly", priority: 0.5 },
  { path: "/privacy", changeFrequency: "yearly", priority: 0.3 },
  { path: "/terms", changeFrequency: "yearly", priority: 0.3 },
] as const;
