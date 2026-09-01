-- Commerce: carts, orders, payments, proofs, reviews and contact requests.
--
-- The lifecycle this encodes is the client's own, transcribed in
-- docs/decisions/0005-order-lifecycle-and-reviews.md from their answer to Q6.
--
-- Four rules from AGENTS.md shape almost every column here:
--
--   §6  An order SNAPSHOTS price, product name and variant at placement. No
--       historical figure is ever recomputed by joining to live product data.
--   §6  Money is an integer count of kobo. Never a float.
--   §6  Nothing is hard-deleted.
--   §3  Order placement is idempotent, because Nigerian mobile data drops
--       mid-request and a double-submitted order is a real, foreseeable loss.
--
-- Naming note: the table is `customer_order`, not `order`. ORDER is a reserved
-- word in the Postgres grammar CockroachDB implements, and a table that must be
-- quoted at every single call site is a permanent tax and an eventual outage.

-- ---------------------------------------------------------------------------
-- Carts. A guest cart is keyed by an opaque token in a cookie; signing in
-- merges it into the customer's own cart rather than discarding either.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS cart (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Exactly one of these is set. A guest cart has a token; once it is claimed by
  -- a customer the token is cleared and customer_id is set.
  token_hash  STRING,
  customer_id UUID REFERENCES customer(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Set when the cart becomes an order, so it is never checked out twice.
  converted_at TIMESTAMPTZ,
  CONSTRAINT cart_has_one_owner CHECK (
    (token_hash IS NOT NULL AND customer_id IS NULL)
    OR (token_hash IS NULL AND customer_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS cart_token_idx
  ON cart (token_hash) WHERE token_hash IS NOT NULL AND converted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS cart_customer_idx
  ON cart (customer_id) WHERE customer_id IS NOT NULL AND converted_at IS NULL;
CREATE INDEX IF NOT EXISTS cart_sweep_idx ON cart (updated_at) WHERE converted_at IS NULL;

-- A cart line holds no price. Price is read live from the variant while the cart
-- is a cart, and frozen only at placement — so a cart left open for a week shows
-- today's price, and a placed order never changes.
CREATE TABLE IF NOT EXISTS cart_item (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id    UUID NOT NULL REFERENCES cart(id) ON DELETE CASCADE,
  variant_id UUID NOT NULL REFERENCES product_variant(id) ON DELETE CASCADE,
  quantity   INT NOT NULL CHECK (quantity > 0 AND quantity <= 99),
  added_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS cart_item_unique_idx ON cart_item (cart_id, variant_id);
CREATE INDEX IF NOT EXISTS cart_item_variant_idx ON cart_item (variant_id);

-- ---------------------------------------------------------------------------
-- Orders.
--
-- customer_id is NULLABLE and that is deliberate: ADR 0002's "Create my Pouch
-- Villa account" checkbox is a real choice, so an order may belong to no
-- account. Contact details live on the order itself as well, which is also what
-- keeps a receipt correct after someone edits their profile.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS customer_order (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Generated from a CSPRNG with real entropy. The prototype used Math.random()
  -- and four digits against a UNIQUE column, which fails a customer's checkout
  -- at real volume rather than merely being untidy.
  reference      STRING NOT NULL,
  customer_id    UUID REFERENCES customer(id),

  -- Contact details as given at checkout. The phone is security-bearing: ADR
  -- 0002 authorises order tracking by reference + phone, because the email is
  -- deliberately unverified and therefore is not an identity proof.
  contact_name   STRING NOT NULL,
  contact_email  STRING NOT NULL,
  contact_phone  STRING NOT NULL,

  fulfilment     STRING NOT NULL CHECK (fulfilment IN ('delivery', 'pickup')),

  -- Q6 names all three. A landmark is how an address is actually given here.
  delivery_zone_id  UUID REFERENCES delivery_zone(id),
  delivery_lga      STRING,
  delivery_address  STRING,
  delivery_landmark STRING,

  status         STRING NOT NULL DEFAULT 'awaiting_payment' CHECK (
                   status IN (
                     'awaiting_payment',
                     'proof_submitted',
                     'payment_confirmed',
                     'preparing',
                     'ready_for_pickup',
                     'dispatched',
                     'completed',
                     'cancelled'
                   )
                 ),

  -- Snapshotted totals. delivery_fee_kobo is frozen from the zone at placement,
  -- so a later fee rise never retro-prices an order already placed.
  subtotal_kobo     INT NOT NULL CHECK (subtotal_kobo >= 0),
  delivery_fee_kobo INT NOT NULL DEFAULT 0 CHECK (delivery_fee_kobo >= 0),
  total_kobo        INT NOT NULL CHECK (total_kobo >= 0),
  currency          STRING NOT NULL DEFAULT 'NGN',

  customer_note  STRING,
  placed_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at   TIMESTAMPTZ,
  cancelled_at   TIMESTAMPTZ,
  cancel_reason  STRING,
  deleted_at     TIMESTAMPTZ,
  deleted_by     UUID REFERENCES staff(id),
  deleted_reason STRING,

  -- A delivery order must say where it is going; a pickup order must not carry
  -- a zone it will never use.
  CONSTRAINT customer_order_delivery_addressed CHECK (
    fulfilment <> 'delivery' OR delivery_address IS NOT NULL
  ),
  CONSTRAINT customer_order_pickup_has_no_zone CHECK (
    fulfilment <> 'pickup' OR delivery_zone_id IS NULL
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS customer_order_reference_idx ON customer_order (reference);
CREATE INDEX IF NOT EXISTS customer_order_customer_idx ON customer_order (customer_id, placed_at DESC);
CREATE INDEX IF NOT EXISTS customer_order_status_idx ON customer_order (status, placed_at DESC);
CREATE INDEX IF NOT EXISTS customer_order_zone_idx ON customer_order (delivery_zone_id);
-- Order tracking looks up by reference + phone; the reference index above leads,
-- and this supports the admin's "find every order from this number" search.
CREATE INDEX IF NOT EXISTS customer_order_phone_idx ON customer_order (contact_phone, placed_at DESC);

-- ---------------------------------------------------------------------------
-- Order lines. Every buyer-visible fact is frozen here at placement.
--
-- product_id and variant_id are kept for reporting and for linking a review to
-- a purchase, but NOTHING rendered on a receipt is read through them. They are
-- nullable and ON DELETE SET NULL: a product that is later purged must not take
-- an order's history with it.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS order_line (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        UUID NOT NULL REFERENCES customer_order(id) ON DELETE CASCADE,
  product_id      UUID REFERENCES product(id) ON DELETE SET NULL,
  variant_id      UUID REFERENCES product_variant(id) ON DELETE SET NULL,

  product_name    STRING NOT NULL,
  product_slug    STRING NOT NULL,
  variant_sku     STRING NOT NULL,
  variant_axes    JSONB NOT NULL DEFAULT '{}'::JSONB,
  brand_name      STRING,
  image_url       STRING,

  unit_price_kobo INT NOT NULL CHECK (unit_price_kobo >= 0),
  quantity        INT NOT NULL CHECK (quantity > 0 AND quantity <= 99),
  line_total_kobo INT NOT NULL CHECK (line_total_kobo >= 0),

  sort_order      INT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS order_line_order_idx ON order_line (order_id, sort_order);
CREATE INDEX IF NOT EXISTS order_line_product_idx ON order_line (product_id);
CREATE INDEX IF NOT EXISTS order_line_variant_idx ON order_line (variant_id);

-- ---------------------------------------------------------------------------
-- The order timeline. Deliberately NOT audit_event: this one is read by the
-- customer on the tracking page, so it holds only what a customer may see, and
-- it has a different retention story. Privileged transitions write both.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS order_event (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    UUID NOT NULL REFERENCES customer_order(id) ON DELETE CASCADE,
  from_status STRING,
  to_status   STRING NOT NULL,
  actor_type  STRING NOT NULL CHECK (actor_type IN ('staff', 'customer', 'system')),
  actor_id    UUID,
  -- Customer-safe wording only. Never an internal note or a staff name.
  note        STRING,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS order_event_order_idx ON order_event (order_id, occurred_at);

-- ---------------------------------------------------------------------------
-- Payments. One transfer per order in V1, but modelled as rows so a partial or
-- corrected transfer — which Q6 asks about — does not need a migration.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS payment (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id      UUID NOT NULL REFERENCES customer_order(id) ON DELETE CASCADE,
  method        STRING NOT NULL DEFAULT 'bank_transfer' CHECK (method IN ('bank_transfer')),
  amount_kobo   INT NOT NULL CHECK (amount_kobo >= 0),
  currency      STRING NOT NULL DEFAULT 'NGN',
  status        STRING NOT NULL DEFAULT 'expected'
                CHECK (status IN ('expected', 'under_review', 'confirmed', 'rejected')),
  -- What the staff member actually saw on the bank statement. Never rendered to
  -- a customer, and never the account number itself.
  reference_note STRING,
  confirmed_at  TIMESTAMPTZ,
  confirmed_by  UUID REFERENCES staff(id),
  rejected_at   TIMESTAMPTZ,
  rejected_by   UUID REFERENCES staff(id),
  reject_reason STRING,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payment_order_idx ON payment (order_id);
CREATE INDEX IF NOT EXISTS payment_status_idx ON payment (status, created_at DESC);
CREATE INDEX IF NOT EXISTS payment_confirmed_by_idx ON payment (confirmed_by);

-- ---------------------------------------------------------------------------
-- Payment proofs. AGENTS.md §5 and §8: these are financial documents containing
-- bank details. PRIVATE bucket, short-lived signed URLs, every access audited,
-- never public and never served from an app path.
--
-- Only the R2 key is stored. There is no URL column, because a stored URL is a
-- URL that can be logged, copied into an error message, or pasted into a ticket.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS payment_proof (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id      UUID NOT NULL REFERENCES customer_order(id) ON DELETE CASCADE,
  payment_id    UUID REFERENCES payment(id) ON DELETE SET NULL,
  r2_key        STRING NOT NULL UNIQUE,
  content_type  STRING NOT NULL,
  byte_size     INT NOT NULL CHECK (byte_size > 0),
  content_hash  STRING NOT NULL,
  status        STRING NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'accepted', 'rejected')),
  uploaded_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at   TIMESTAMPTZ,
  reviewed_by   UUID REFERENCES staff(id),
  reject_reason STRING
);

CREATE INDEX IF NOT EXISTS payment_proof_order_idx ON payment_proof (order_id, uploaded_at DESC);
CREATE INDEX IF NOT EXISTS payment_proof_payment_idx ON payment_proof (payment_id);
CREATE INDEX IF NOT EXISTS payment_proof_status_idx ON payment_proof (status, uploaded_at);
CREATE INDEX IF NOT EXISTS payment_proof_reviewed_by_idx ON payment_proof (reviewed_by);

-- A proof upload is staged before it is trusted, exactly as product media is:
-- the browser PUTs to R2, then the server fetches the bytes back and checks the
-- magic bytes before any row points at them.
CREATE TABLE IF NOT EXISTS payment_proof_upload (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id      UUID NOT NULL REFERENCES customer_order(id) ON DELETE CASCADE,
  staging_key   STRING NOT NULL UNIQUE,
  status        STRING NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'finalised', 'rejected')),
  reject_reason STRING,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  finalised_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS payment_proof_upload_order_idx ON payment_proof_upload (order_id);
CREATE INDEX IF NOT EXISTS payment_proof_upload_sweep_idx ON payment_proof_upload (status, created_at);

-- ---------------------------------------------------------------------------
-- Reviews. Per ADR 0005 and the client's Q9 answer: anyone may review, and
-- every review is held for approval before publication.
--
-- customer_id is nullable because no account is required. submitted_ip exists
-- for rate limiting and moderation only, and is never rendered.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS review (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id     UUID NOT NULL REFERENCES product(id) ON DELETE CASCADE,
  customer_id    UUID REFERENCES customer(id) ON DELETE SET NULL,
  order_line_id  UUID REFERENCES order_line(id) ON DELETE SET NULL,

  author_name    STRING NOT NULL,
  author_email   STRING,
  rating         INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title          STRING,
  body           STRING NOT NULL,

  -- Computed once at submission and stored. Recomputing it later would let an
  -- order placed afterwards retroactively change a published review's meaning.
  verified_purchase BOOL NOT NULL DEFAULT false,

  status         STRING NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'approved', 'rejected')),
  submitted_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  submitted_ip   STRING,
  moderated_at   TIMESTAMPTZ,
  moderated_by   UUID REFERENCES staff(id),
  reject_reason  STRING,
  deleted_at     TIMESTAMPTZ,
  deleted_by     UUID REFERENCES staff(id),
  deleted_reason STRING
);

-- The storefront only ever reads approved, undeleted reviews for one product.
CREATE INDEX IF NOT EXISTS review_product_published_idx
  ON review (product_id, submitted_at DESC) WHERE status = 'approved' AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS review_moderation_idx
  ON review (status, submitted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS review_customer_idx ON review (customer_id);
CREATE INDEX IF NOT EXISTS review_order_line_idx ON review (order_line_id);
CREATE INDEX IF NOT EXISTS review_moderated_by_idx ON review (moderated_by);

-- ---------------------------------------------------------------------------
-- Contact requests. Scope item 12 and admin page 07.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS contact_request (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         STRING NOT NULL,
  email        STRING,
  phone        STRING,
  subject      STRING,
  message      STRING NOT NULL,
  order_reference STRING,
  status       STRING NOT NULL DEFAULT 'new'
               CHECK (status IN ('new', 'in_progress', 'closed')),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  submitted_ip STRING,
  handled_by   UUID REFERENCES staff(id),
  handled_at   TIMESTAMPTZ,
  staff_note   STRING,
  deleted_at   TIMESTAMPTZ,
  deleted_by   UUID REFERENCES staff(id),
  deleted_reason STRING,
  CONSTRAINT contact_request_reachable CHECK (email IS NOT NULL OR phone IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS contact_request_status_idx
  ON contact_request (status, submitted_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS contact_request_handled_by_idx ON contact_request (handled_by);

-- ---------------------------------------------------------------------------
-- Idempotency. AGENTS.md §3 requires this on order placement and payment-proof
-- submission specifically.
--
-- The UNIQUE constraint on `key` is what does the work: a replayed request
-- collides on insert inside the same transaction that creates the order, so
-- exactly one order exists no matter how many times a flaky connection retries.
-- request_hash catches the other failure — the same key deliberately reused for
-- a *different* payload, which is a client bug and must not silently return
-- someone else's order.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS idempotency_key (
  key          STRING NOT NULL,
  scope        STRING NOT NULL,
  request_hash STRING NOT NULL,
  -- The id of whatever was created, so a replay returns the original result
  -- rather than an error.
  result_id    STRING,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (scope, key)
);

CREATE INDEX IF NOT EXISTS idempotency_key_sweep_idx ON idempotency_key (created_at);

-- ---------------------------------------------------------------------------
-- Customer password recovery. Code-based, on the same reasoning as ADR 0002's
-- staff verification: a magic link leaks through shared inboxes and forwarded
-- mail, breaks in in-app browsers, and is phishable in a way a code typed into
-- a page the user already has open is not.
--
-- Only the hash is stored, so a database read does not hand over a working code.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS customer_password_reset (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customer(id) ON DELETE CASCADE,
  code_hash   STRING NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  attempts    INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  requested_ip STRING
);

CREATE INDEX IF NOT EXISTS customer_password_reset_customer_idx
  ON customer_password_reset (customer_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Rate limiting. §5 requires per-IP AND per-account limits on authentication,
-- password reset, payment-proof upload and review submission.
--
-- Staff login counts failures out of audit_event, which works because a staff
-- login failure genuinely is an auditable security event. Anonymous review
-- submissions are not: writing every one into the append-only audit trail would
-- fill the record staff actually read with noise from strangers. So they get
-- their own table, which is also sweepable — the audit trail is not.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS rate_limit_hit (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket      STRING NOT NULL,
  subject     STRING NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rate_limit_hit_lookup_idx ON rate_limit_hit (bucket, subject, occurred_at DESC);
CREATE INDEX IF NOT EXISTS rate_limit_hit_sweep_idx ON rate_limit_hit (occurred_at);

-- ---------------------------------------------------------------------------
-- Close the loop on stock. 0003 left stock_entry.order_id as a bare UUID
-- because the table it refers to did not exist yet. It exists now.
-- ---------------------------------------------------------------------------

ALTER TABLE stock_entry
  ADD CONSTRAINT stock_entry_order_fk
  FOREIGN KEY (order_id) REFERENCES customer_order(id);

CREATE INDEX IF NOT EXISTS stock_entry_order_idx ON stock_entry (order_id);

-- Customers get one more column: the phone that ADR 0002 makes security-bearing
-- for order tracking is normalised before storage, and the normalised form is
-- what lookups compare against.
ALTER TABLE customer ADD COLUMN IF NOT EXISTS phone_normalised STRING;
CREATE INDEX IF NOT EXISTS customer_phone_normalised_idx ON customer (phone_normalised);
