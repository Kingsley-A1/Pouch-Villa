/**
 * How a home-page section is drawn.
 *
 * In `domain/` rather than beside the service that reads it, because
 * `domain/schemas.ts` validates it and the frontend imports those schemas into
 * forms. A schema that reached for the service would pull `db/client`, and with
 * it the Postgres driver, into a client bundle through a transitive import —
 * the exact failure the backend barrel deliberately omits `./db` to prevent.
 *
 * Pure data with no imports, so both sides can have it.
 *
 * What each treatment is for, and why there are only three, is argued in
 * `migrations/0010_section_layout.sql`.
 */
export const SECTION_LAYOUTS = ["grid", "feature", "band"] as const;

export type HomeSectionLayout = (typeof SECTION_LAYOUTS)[number];

/** What the admin picker shows against each option. */
export const SECTION_LAYOUT_LABELS: Record<HomeSectionLayout, { name: string; hint: string }> = {
  grid: { name: "Even grid", hint: "Every product the same size. The default." },
  feature: {
    name: "Feature",
    hint: "The first product leads at double size. Suits a small, considered range.",
  },
  band: {
    name: "Tinted band",
    hint: "A full-width tinted block with the heading beside the products.",
  },
};
