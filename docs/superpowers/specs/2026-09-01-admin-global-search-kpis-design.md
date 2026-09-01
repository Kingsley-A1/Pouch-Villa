# Admin Global Search and Additive KPIs

**Status:** Approved
**Date:** 2026-09-01

## Objective

Make the admin home more useful without removing its current overview totals, add a responsive
global search component that covers every reachable admin business area, and finish the two
approved authentication/dashboard alignment fixes. The release must be isolated from unrelated
work and safe to reuse when `@pv/backend` is adopted by another application.

## Scope

1. Centre the Google OAuth button on the staff login and account-claim screens at every supported
   width.
2. Remove the complete role/admin subtitle beneath the dashboard welcome heading.
3. Retain the existing Products, Categories, Brands, Active staff, and Customers overview cards.
4. Add permission-aware operational dashboard sections for sales, orders, action queues, and low
   stock.
5. Add an inline global admin search component. It is not a search page.
6. Add a route-neutral, reusable backend search contract and indexed document store.
7. Backfill existing records, update search documents transactionally with source mutations, and
   provide a repair/rebuild command.

## Global Search Experience

The desktop admin header contains a centred search control between the brand link and staff actions.
On narrow screens it becomes a 44 by 44 pixel search button that opens a full-width dialog. The same
`AdminSearch` component owns both presentations.

The component searches immediately after two non-whitespace characters with a 250 ms debounce. It
aborts stale requests, caps backend results at 20, groups results by entity type, and includes the
already-authorised admin navigation sections as local results. It supports pointer input, keyboard
navigation, Escape, Enter, `/`, and Command/Ctrl+K. Loading, empty, offline, and server-error states
are explicit. Reduced-motion preferences disable non-essential transitions.

The search component receives authorised navigation sections from the server. It calls
`GET /api/v1/admin/search?q=...`; there is no standalone admin search route.

## Backend Search Contract

`@pv/backend/services/admin-search` exports a route-neutral contract:

```ts
export type AdminSearchEntity =
  | "product"
  | "order"
  | "customer"
  | "payment"
  | "brand"
  | "category"
  | "device"
  | "staff"
  | "review"
  | "enquiry"
  | "delivery_zone"
  | "setting";

export type AdminSearchResult = {
  entity: AdminSearchEntity;
  entityId: string;
  title: string;
  context: string | null;
  requiredPermission: PermissionCode;
};

export function searchAdmin(
  actorStaffId: string,
  input: { query: string; limit?: number },
): Promise<AdminSearchResult[]>;
```

The backend does not know about Next.js or admin URLs. The frontend maps each entity type to a route,
so another application can reuse the package with a different information architecture.

## Search Index

Migration `0008_admin_search.sql` adds a derived `admin_search_document` table with a composite
`(entity_type, entity_id)` key, display-safe title/context, search-only text, required permission,
timestamps, a stored `TSVECTOR`, an inverted full-text index, and a trigram index for misspellings.
The table is derived infrastructure rather than business truth.

Each source service updates or removes its search document in the same retry-aware transaction as
the source mutation. A bounded rebuild service and CLI command repopulate the table from canonical
records. The migration backfills existing records so the release is useful immediately.

Searchable sources and authority:

| Source             | Required permission | Safe searchable identity                    |
| ------------------ | ------------------- | ------------------------------------------- |
| Product and SKU    | `product.view`      | name, slug, SKU                             |
| Order              | `order.view`        | reference, customer name, email, phone      |
| Customer           | `customer.view`     | name, email, phone                          |
| Payment            | `payment.view`      | order reference and payment status          |
| Brand and category | `category.manage`   | name and slug                               |
| Device             | `category.manage`   | brand, model name, slug                     |
| Staff              | `staff.view`        | name, email, role                           |
| Review             | `review.moderate`   | reviewer, product snapshot, order reference |
| Enquiry            | `enquiry.manage`    | sender name, email, phone                   |
| Delivery zone      | `delivery.manage`   | name and LGA                                |
| Setting            | `settings.view`     | typed setting key and admin label only      |

The index never contains passwords, tokens, session identifiers, bank details, payment-proof URLs or
keys, setting values, enquiry messages, review bodies, or audit before/after payloads. Audit events
are excluded because the current admin has no audit screen to open from a result.

`searchAdmin` re-derives the actor's active status and permissions inside the database query. A result
whose permission is not currently granted is never returned. The query is normalized and bounded;
raw search text is never written to application logs or audit events.

## Frontend Route Mapping

`admin-search-routes.ts` is the only route-aware layer. Detail routes are used where they exist;
otherwise the result opens the relevant filtered/list screen. Unknown entity types fail closed and
are not rendered.

## Dashboard

The dashboard order is:

1. Welcome heading, with no role/admin subtitle.
2. `Needs you`: non-zero payment proofs, paid orders to prepare, pending reviews, and new enquiries.
3. `Sales & orders`: revenue today, revenue in the last seven days, open paid orders, and orders
   awaiting payment. Order counts remain visible as supporting text on revenue cards.
4. `Overview`: the existing Products, Categories, Brands, Active staff, and Customers cards,
   unchanged in meaning.
5. `Running low`: published variants at or below the existing low-stock threshold.

Every section and result is permission-aware. Money remains integer kobo and is counted only after
payment confirmation. Empty action queues do not render fake activity.

## OAuth Alignment

The Google-rendered button is measured against a full-width centred host and rendered at the smaller
of 320 pixels or the available width. Login and account claim reuse the same component. Pending and
error messages remain readable and do not alter the button's horizontal alignment.

## Failure and Security Behaviour

- Unauthenticated search requests return 401; authenticated but inactive staff receive no results.
- Missing permissions suppress both navigation and record results.
- Queries shorter than two characters return an empty result without touching the search index.
- Database/API errors produce a compact retryable state and never expose driver messages.
- Search requests are bounded and rate-limited per staff account.
- All database work remains Node-only; no driver or credential crosses into a Client Component.

## Verification

- Backend unit tests cover query normalization, limits, route-neutral mapping, and forbidden fields.
- CockroachDB integration tests cover backfill, fuzzy matching, updates/removals, and a role-by-source
  permission matrix.
- Route tests cover authentication, validation, bounds, and safe errors.
- Component tests cover debounce, stale-request cancellation, grouping, keyboard navigation, empty
  and error states, mobile dialog behaviour, and OAuth centring.
- Dashboard tests assert that the five existing overview cards remain and operational sections are
  additive.
- Run `pnpm run verify`, inspect at 320/360 pixels and desktop, then migrate, deploy, and verify live
  authentication/dashboard routes without claiming database-backed evidence that was not observed.

## Release Boundary

Work begins from the fetched `origin/main` in `PouchVilla-admin-search-release`. Only files named by
the implementation plan may be committed. The migration is forward-only. Push and deployment are
authorised only after the isolated diff, complete verification output, and migration preflight have
been reviewed.
