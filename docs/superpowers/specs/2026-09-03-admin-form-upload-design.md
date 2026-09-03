# Admin Form and Upload Reliability Design

## Outcome

Make delivery-zone and product-variant editing safe for non-technical staff, correct the CockroachDB money read failure, restore direct R2 uploads from the production domains, and tighten the desktop admin header and settings interaction without changing permissions or data ownership.

## Form behaviour

- Delivery zones use a required location select with `Calabar Municipal`, `Calabar South`, and `Outside Calabar`.
- Minimum and maximum delivery days remain optional and show example placeholders.
- Delivery-zone and variant sort order is assigned by the service as the next value in its scope. Existing rows keep their order when edited; no sort-order field is rendered.
- A variant SKU is generated once at creation from a normalized product-name stem and a cryptographically random four-character code. The SKU is shown read-only during edits and never changes when the product is renamed.
- Every editable naira amount uses one reusable text input that displays grouping commas, accepts digits and an optional two-digit decimal fraction, and submits an unformatted value for exact conversion to integer kobo.

## Data correctness

CockroachDB `INT8` money columns are selected as strings and explicitly converted to numbers before entering the branded `Kobo` type. Delivery-zone and variant reads follow the already-correct catalogue and order patterns. Form conversion uses the shared `nairaToKobo` boundary rather than duplicating multiplication.

## Uploads

The public and private R2 buckets allow preflighted browser `PUT` requests from the apex and `www` production origins, allow only the headers used by the upload request, and expose `ETag`. The repository includes an idempotent, environment-driven CORS command so a cloned deployment can apply the same narrow policy without copying Pouch Villa bucket names. Upload UI distinguishes an unreachable storage endpoint/configuration failure from a rejected file.

## Admin presentation

At desktop widths, the header is a three-column grid: brand at left, search centered independently of neighbouring widths, and identity/actions at right. Identity includes a two-letter avatar, full name, and role. On the settings page, each section is a native, keyboard-accessible disclosure closed by default; its summary includes an edit icon and the form mounts inside it.

## Verification

Regression tests cover strict money decoding, formatted money input normalization, automatic SKU/order creation, stable variant updates, header alignment/identity, collapsed settings, and upload error classification. The full repository verification runs before commit. R2 CORS is read back after application, then the pushed deployment and live routes are checked separately.
