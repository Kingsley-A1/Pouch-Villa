# Pouch Villa Digital Storefront & Sales System

A complete mobile-first Next.js prototype for discovering device-compatible phone cases, saving products, preparing WhatsApp enquiries, reserving for pickup, and managing catalogue and customer requests from a protected staff application.

> Prototype preview — products, prices and availability are demonstration data only.

## Quick start

Requirements: Node.js 24+ and npm 11+.

```bash
npm install
npm run setup
npm run dev
```

Open `http://localhost:3000`. `npm run setup` creates a local `.env.local`, seeds `data/pouch-villa-prototype.db`, and prints a newly generated demonstration admin password. Sign in at `/admin/login` with those generated credentials.

Do not reuse the generated prototype password or database for production.

## Available commands

```bash
npm run setup        # create local configuration and seed the SQLite database
npm run dev          # run the development server
npm run lint         # ESLint with zero warnings allowed
npm run typecheck    # strict TypeScript check
npm run test         # automated unit, accessibility, database and journey tests
npm run build        # optimized Next.js production build
npm run test:routes  # start the production build and verify all primary routes
npm run verify       # run the complete verification sequence
```

## Customer journey

1. Start on the homepage and choose **Find My Phone**.
2. Select Apple → iPhone 15 Pro (or another seeded device).
3. Browse the exact compatibility-filtered route.
4. Open a product, confirm the device, and choose a variant.
5. Save locally, prepare a WhatsApp message preview, or reserve for pickup.
6. Submit the reservation to receive a `PV-R-…` reference.

Saved items, remembered phone, and recently viewed products use browser-local storage because public customer accounts are intentionally out of scope.

## Staff journey

1. Run `npm run setup` and use the printed demonstration credentials at `/admin/login`.
2. Review dashboard KPIs and recent activity.
3. Create, edit, duplicate, publish, unpublish, archive, and preview products.
4. Manage structured device compatibility and product/variant availability.
5. Move reservations through New → Contacted → Confirmed → Ready → Completed/Cancelled.
6. Manage enquiries, case requests, collections, customers, media, content, settings, staff, analytics, and audit history.

Permissions are enforced inside server actions through role checks; interface visibility is not the security boundary.

## Environment

Copy `.env.example` manually only if you are not using `npm run setup`.

- `DATABASE_URL`: local SQLite file. A writable `/tmp` path is required on ephemeral preview hosting.
- `AUTH_SECRET`: required in production; at least 32 characters. Production startup refuses a missing or short secret.
- `DEMO_ADMIN_EMAIL` / `DEMO_ADMIN_PASSWORD`: used only when seeding a new database.
- `NEXT_PUBLIC_WHATSAPP_NUMBER`: leave blank until Pouch Villa confirms the real number. Blank configuration opens a message preview instead of a fabricated WhatsApp destination.
- `NEXT_PUBLIC_STORE_ADDRESS` / `NEXT_PUBLIC_STORE_HOURS`: optional confirmed business details.

Never commit `.env.local`, the generated database, real customer data, or uploaded staff media.

## Project map

```text
src/app/(store)              Public storefront routes and server actions
src/app/admin                Authentication and protected staff application
src/components               Reusable accessible UI and interaction components
src/lib/db.ts                Typed SQLite queries and catalogue projections
src/lib/auth.ts              Signed HttpOnly admin sessions
src/lib/permissions.ts       Role-permission policy
database/schema.sql          Canonical development schema
src/lib/seed-data.ts         Fictional demonstration seed data
scripts/setup.ts             One-command local setup
tests                        Automated verification
docs                         Architecture, assumptions, testing and deployment handover
```

## Documentation

- [Architecture](docs/architecture.md)
- [Assumptions and client confirmations](docs/assumptions-and-confirmations.md)
- [Testing report](docs/testing-report.md)
- [Deployment instructions](docs/deployment.md)
- [Production promotion path](docs/production-promotion.md)

## Data and brand safeguards

The supplied storefront photograph confirms the red/white Pouch Villa identity and is used only on the Visit Us experience. A clean official logo file was not supplied, so the interface uses a text wordmark and a simple phone-case mark until approved brand artwork is available. Product names, images, prices, availability, enquiries, customers, analytics and references are explicitly fictional demonstration data.

The research package available during discovery described a hospitality business and conflicted with the client brief and supplied evidence. Those claims were rejected; this prototype follows the retailer brief supplied in this project.
