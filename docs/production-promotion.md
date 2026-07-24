# Production promotion path

## 1. Confirm the operating model

Approve the compatibility matrix, reservation rules, stock ownership, staff roles, business contacts, policies, branding, domain and success measures. Replace every demonstration record and awaiting-confirmation state with signed-off client data.

## 2. Upgrade persistence

- Migrate the relational schema to managed PostgreSQL with versioned migrations.
- Use a connection pool that supports the chosen server/runtime topology.
- Move uploads to private object storage with image processing, malware scanning and signed access.
- Add tested backups, restore drills, retention rules and staging data isolation.

## 3. Harden identity and operations

- Integrate managed workforce identity or password reset/MFA for staff.
- Put login throttling in Redis or another shared store and add IP/device safeguards.
- Add CSRF/origin monitoring, security headers, dependency scanning and secret rotation.
- Define least-privilege production roles and review the audit log retention policy.

## 4. Integrate approved channels

Configure the confirmed WhatsApp destination and approved message templates. If automated messages are later authorised, use an official provider, record consent, add delivery/error handling and keep human review in the loop. Do not introduce payments without a separate checkout/security scope.

## 5. Validate and launch

- Import and reconcile real catalogue data in staging.
- Run compatibility sampling with physical devices/cases.
- Complete WCAG 2.2 AA testing with keyboard, screen reader and real mobile devices.
- Complete performance, load, security and privacy reviews.
- Train staff on catalogue freshness, reservation states and audit expectations.
- Run a limited Calabar store pilot, measure successful compatible-case discovery and reservation completion, then promote the approved build behind the production domain.

## 6. Operate

Monitor errors, slow routes, zero-result searches, stale availability, reservation response time and database health. Establish owners and service targets before collecting real customer data.
