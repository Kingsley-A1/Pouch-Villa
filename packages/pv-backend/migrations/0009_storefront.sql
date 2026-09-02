-- Storefront composition and likes.
--
-- Two capabilities the storefront was missing, and one shared idea behind them:
-- what a shopper sees on the home page is a decision the CEO makes at runtime,
-- not a decision an engineer makes at deploy time.
--
-- Until now the home page rendered one hardcoded "Latest" grid of the eight most
-- recently published products. That is the only arrangement the business could
-- ever have, and changing it needed a deployment — the same failure mode
-- AGENTS.md §4 forbids for business facts, applied to merchandising.

-- ---------------------------------------------------------------------------
-- Home sections.
--
-- Three kinds, because a shop genuinely merchandises in three different ways and
-- collapsing them into one would either lose expressiveness or force the CEO to
-- hand-pick rows that a rule already describes:
--
--   category   — "everything in Pouches", filled automatically. Stays correct as
--                products are added; nobody has to remember to update it.
--   brand      — "everything by OtterBox", same reasoning across the catalogue.
--   collection — hand-picked and hand-ordered. The editorial case: "Staff picks",
--                "Back to school", a window display that no rule describes.
--
-- The kind determines which reference is required, and that is enforced here
-- rather than only in code, so a section that renders nothing cannot be stored.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS home_section (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  kind        STRING NOT NULL CHECK (kind IN ('category', 'brand', 'collection')),

  -- The heading a shopper reads. Deliberately not derived from the category or
  -- brand name: "Protect your phone" sells better than "Cases", and the CEO
  -- should be able to say so without renaming the category the whole catalogue
  -- is filed under.
  title       STRING NOT NULL,
  subtitle    STRING,

  category_id UUID REFERENCES category(id),
  brand_id    UUID REFERENCES brand(id),

  -- A cap, not a target. A category section shows the newest N of what matches.
  max_items   INT NOT NULL DEFAULT 8 CHECK (max_items BETWEEN 1 AND 24),

  sort_order  INT NOT NULL DEFAULT 0,
  is_active   BOOL NOT NULL DEFAULT true,

  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by     UUID REFERENCES staff(id),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by     UUID REFERENCES staff(id),
  deleted_at     TIMESTAMPTZ,
  deleted_by     UUID REFERENCES staff(id),
  deleted_reason STRING,

  CONSTRAINT home_section_reference_matches_kind CHECK (
    (kind = 'category'   AND category_id IS NOT NULL AND brand_id IS NULL)
    OR (kind = 'brand'      AND brand_id IS NOT NULL AND category_id IS NULL)
    OR (kind = 'collection' AND category_id IS NULL  AND brand_id IS NULL)
  )
);

-- The storefront read: every live section in display order, one bounded query.
CREATE INDEX IF NOT EXISTS home_section_live_idx
  ON home_section (sort_order, id) WHERE is_active AND deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- Collection membership. This is the table behind "where does this product land
-- on the public site" in the product form: a product's categories decide what it
-- is, and its collection rows decide where it is *shown*.
--
-- Ordered, because an editorial collection whose order nobody controls is just a
-- worse category section.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS home_section_product (
  section_id UUID NOT NULL REFERENCES home_section(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES product(id) ON DELETE CASCADE,
  sort_order INT NOT NULL DEFAULT 0,
  added_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  added_by   UUID REFERENCES staff(id),
  PRIMARY KEY (section_id, product_id)
);

-- Every foreign key gets an index (§6). This one also answers the product form's
-- "which collections is this product already in".
CREATE INDEX IF NOT EXISTS home_section_product_product_idx
  ON home_section_product (product_id);

-- ---------------------------------------------------------------------------
-- Likes.
--
-- A like is attributable to exactly one actor: a signed-in customer, or a
-- signed-out visitor holding an opaque cookie. Both are supported on purpose.
-- Requiring an account would measure almost nothing on a shop whose visitors are
-- overwhelmingly signed out, and the signed-out like is what a shopper uses as a
-- shortlist while deciding.
--
-- `visitor_key` is the SHA-256 of the cookie value, never the value itself, so a
-- database reader cannot forge the cookie that produced a row — the same
-- treatment session tokens and cart tokens already get.
--
-- Not soft-deleted. §6's rule protects records the business must be able to
-- account for later; an unlike is a withdrawal of an opinion, and keeping a
-- tombstone of it would mean retaining a person's browsing interest after they
-- explicitly took it back.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS product_like (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  UUID NOT NULL REFERENCES product(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customer(id) ON DELETE CASCADE,
  visitor_key STRING,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT product_like_has_one_actor CHECK (
    (customer_id IS NOT NULL AND visitor_key IS NULL)
    OR (customer_id IS NULL AND visitor_key IS NOT NULL)
  )
);

-- One like per actor per product. Enforced by the database rather than by a
-- read-then-write in the service, which under serializable isolation and a
-- double-tapped button is a race, not a check.
CREATE UNIQUE INDEX IF NOT EXISTS product_like_customer_idx
  ON product_like (product_id, customer_id) WHERE customer_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS product_like_visitor_idx
  ON product_like (product_id, visitor_key) WHERE visitor_key IS NOT NULL;

-- The count, and the admin's "most liked" ordering.
CREATE INDEX IF NOT EXISTS product_like_product_idx ON product_like (product_id);

-- "What have I saved", for the profile. Ordered newest first, as it is shown.
CREATE INDEX IF NOT EXISTS product_like_customer_saved_idx
  ON product_like (customer_id, created_at DESC) WHERE customer_id IS NOT NULL;
