# Deployment instructions

## Local production run

```bash
npm install
npm run setup
npm run verify
npm run start
```

Use a unique `AUTH_SECRET` and separate admin password for every environment. Keep the database, `.env.local` and uploaded media outside source control.

## Sites private deployment finding

A private Sites deployment was attempted on 17 July 2026 from the exact validated source commit. The remote environment installed dependencies and completed the native `next build`, including TypeScript and route generation. Packaging then failed because the current Sites runtime requires a Worker-compatible `dist/server/index.js` bundle; a canonical Next.js Node application does not emit that artifact.

The application also intentionally uses Node SQLite and local filesystem uploads for the real development database and media prototype. Those Node persistence primitives are not the D1/R2 bindings expected by the Sites Worker runtime. Per the project constraint, the canonical Next.js architecture was preserved instead of being replaced by Vinext, a static mock, or a reduced landing page. There is therefore no live Sites URL for this build.

A future Sites-specific production adaptation would need a reviewed Next-to-Worker adapter plus D1 and R2 data providers while keeping the local Next.js project as the canonical codebase. Its runtime configuration would be:

```text
DATABASE_URL=/tmp/pouch-villa-prototype.db
AUTH_SECRET=<at least 32 random characters>
DEMO_ADMIN_EMAIL=<prototype-only email>
DEMO_ADMIN_PASSWORD=<strong prototype-only password>
NEXT_PUBLIC_WHATSAPP_NUMBER=
NEXT_PUBLIC_STORE_ADDRESS=
NEXT_PUBLIC_STORE_HOURS=
```

Using `/tmp` SQLite would remain ephemeral and is not a safe substitute for D1/PostgreSQL. Staff changes could reset after restart or redeployment and must never be represented as durable production storage.

## Conventional Node hosting

1. Provision Node.js 24+ and writable persistent storage.
2. Inject environment values from the hosting secret manager.
3. Run `npm ci`, `npm run setup`, `npm run build`, and `npm run start`.
4. Terminate TLS at the platform, restrict admin access, and configure monitoring/backups.

For production, complete the database and media migrations described in `production-promotion.md` before accepting real customer data.
