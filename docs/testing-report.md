# Testing report

Date: 17 July 2026

Environment: Node.js 24, Next.js 16.2.10, React 19.2.4, TypeScript strict mode

## Final automated results

| Gate | Result | Evidence |
| --- | --- | --- |
| ESLint | Passed | `eslint . --max-warnings=0`, exit 0, no warnings |
| TypeScript | Passed | `tsc --noEmit`, exit 0 |
| Automated tests | Passed | 5 files, 17 tests after final hardening |
| Production build | Passed locally | Native `next build` compiled, type-checked and generated all routes |
| Production route smoke test | Passed | 16 public/login routes returned HTTP 200; unauthenticated `/admin` returned 307 to `/admin/login` |
| Secret/source check | Passed | `.env.local` and SQLite DB are ignored; no common committed secret patterns found |
| Production dependency audit | Review required | npm reported 2 moderate PostCSS advisories inside Next.js with no available fix |
| Sites deployment | Not deployed | Native Next build passed remotely; Worker packaging failed because no compatible `dist` bundle was emitted |

## Journeys exercised by automation

- Seeds 6 brands, at least 20 models, 30 products and all operational samples.
- Returns only products structurally linked to an exact selected device.
- Rejects reservations for an incompatible device.
- Rejects an invented client-supplied variant.
- Creates a reservation for a linked device and emits a `PV-R-…` confirmation redirect.
- Creates a case request and emits a `PV-C-…` confirmation redirect.
- Makes an admin availability mutation visible to storefront queries.
- Moves a reservation through the staff workflow.
- Checks role permission boundaries for owner, catalogue and viewer roles.
- Runs an axe-core component accessibility check and verifies named branded navigation controls.

## Route verification

The optimized production server rendered:

`/`, `/find-my-case`, `/shop`, `/shop/apple/iphone-15-pro`, `/collections`, `/collections/new-arrivals`, `/products/blush-arc`, `/search`, `/saved`, `/request-case`, `/reservation`, `/visit-us`, `/help`, `/privacy`, `/terms`, and `/admin/login`.

The admin root denied unauthenticated access and redirected to the login route.

## Responsive and accessibility review boundary

The source was inspected for mobile-first breakpoints, overflowing admin tables, minimum 44px navigation targets, visible focus styling, reduced-motion support, semantic labels, descriptive image alternatives, mobile filter/menu controls, and responsive grids. No placeholder links, empty click handlers or dead `#` destinations were found.

A live cloud-browser render was not completed because the session's safety policy recorded the local preview address as explicitly disallowed. The agent did not bypass that decision with another browser surface. Consequently, this report does **not** claim visual viewport inspection, keyboard traversal, screen-reader testing, browser console inspection, or pixel-level comparison as passed. Those remain a pre-production manual gate.

The axe-core test excludes the colour-contrast rule because jsdom cannot calculate real rendered colour/compositing. Source colours were reviewed, but real-browser contrast verification remains required.

## Sites result

The private Sites build log confirms that dependency installation, Next compilation, TypeScript, page-data collection and route generation succeeded. Deployment then stopped at `cp: cannot stat 'dist'`: Sites expects a Worker-compatible output, while this canonical application targets the Next.js Node runtime and uses Node SQLite/filesystem uploads. No private production URL was created, and no claim of a successful Sites deployment is made.

## Known review items

- npm currently reports two moderate PostCSS advisories within Next.js and no available fix; monitor the Next.js security release stream before production.
- Node marks its built-in SQLite API experimental; move to managed PostgreSQL for production.
- Replace the in-memory login limiter with a shared store before horizontal scaling.
- Complete real-device mobile/tablet/desktop, keyboard, screen-reader and contrast testing before public launch.
