-- Catalogue: categories, brands, devices, products, variants, stock and media.
--
-- This is deliberately not a port of the prototype's shape. Two of its decisions
-- cannot come forward:
--
--   * `variants_json TEXT` could not be indexed, filtered or stock-tracked, and
--     its colour filter was a substring match that also hit SKUs and descriptions.
--     Variants are rows here, with their own SKU, price and stock.
--   * `INTEGER PRIMARY KEY AUTOINCREMENT` puts every insert on a single range.
--
-- Variant *axes* are data rather than columns, so the same schema serves
-- colour/size for a pouch and storage/colour/condition if the catalogue ever
-- widens — without a migration under deadline.

-- ---------------------------------------------------------------------------
-- Categories. Two tiers, per the client's restructure: parents with children.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS category (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id      UUID REFERENCES category(id),
  name           STRING NOT NULL,
  slug           STRING NOT NULL,
  description    STRING,
  sort_order     INT NOT NULL DEFAULT 0,
  is_active      BOOL NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at     TIMESTAMPTZ,
  deleted_by     UUID REFERENCES staff(id),
  deleted_reason STRING
);

CREATE UNIQUE INDEX IF NOT EXISTS category_slug_idx ON category (slug) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS category_parent_idx ON category (parent_id, sort_order);

-- ---------------------------------------------------------------------------
-- Brands. A brand filters across the whole catalogue and is never a category —
-- as a category, an OtterBox iPhone case could only live in one place.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS brand (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           STRING NOT NULL,
  slug           STRING NOT NULL,
  sort_order     INT NOT NULL DEFAULT 0,
  is_active      BOOL NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at     TIMESTAMPTZ,
  deleted_by     UUID REFERENCES staff(id),
  deleted_reason STRING
);

CREATE UNIQUE INDEX IF NOT EXISTS brand_slug_idx ON brand (slug) WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- Devices, for "does it fit my phone". With Q1 answered — accessories, no
-- handsets — compatibility is the differentiating facet, not a leftover.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS device (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id      UUID NOT NULL REFERENCES brand(id),
  name          STRING NOT NULL,
  slug          STRING NOT NULL,
  released_year INT,
  sort_order    INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS device_brand_slug_idx ON device (brand_id, slug);

-- ---------------------------------------------------------------------------
-- Products.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS product (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug           STRING NOT NULL,
  name           STRING NOT NULL,
  summary        STRING,
  description    STRING,
  brand_id       UUID REFERENCES brand(id),
  status         STRING NOT NULL DEFAULT 'draft'
                 CHECK (status IN ('draft', 'published', 'unpublished', 'archived')),
  published_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by     UUID REFERENCES staff(id),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by     UUID REFERENCES staff(id),
  deleted_at     TIMESTAMPTZ,
  deleted_by     UUID REFERENCES staff(id),
  deleted_reason STRING
);

CREATE UNIQUE INDEX IF NOT EXISTS product_slug_idx ON product (slug) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS product_brand_idx ON product (brand_id);
CREATE INDEX IF NOT EXISTS product_status_idx ON product (status, published_at DESC);

CREATE TABLE IF NOT EXISTS product_category (
  product_id  UUID NOT NULL REFERENCES product(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES category(id) ON DELETE CASCADE,
  PRIMARY KEY (product_id, category_id)
);

CREATE INDEX IF NOT EXISTS product_category_category_idx ON product_category (category_id);

CREATE TABLE IF NOT EXISTS product_compatibility (
  product_id UUID NOT NULL REFERENCES product(id) ON DELETE CASCADE,
  device_id  UUID NOT NULL REFERENCES device(id) ON DELETE CASCADE,
  PRIMARY KEY (product_id, device_id)
);

CREATE INDEX IF NOT EXISTS product_compatibility_device_idx ON product_compatibility (device_id);

-- ---------------------------------------------------------------------------
-- Variants. One row per buyable thing, with its own SKU and price in kobo.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS product_variant (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id      UUID NOT NULL REFERENCES product(id) ON DELETE CASCADE,
  sku             STRING NOT NULL,
  price_kobo      INT NOT NULL CHECK (price_kobo >= 0),
  compare_at_kobo INT CHECK (compare_at_kobo >= 0),
  currency        STRING NOT NULL DEFAULT 'NGN',
  is_active       BOOL NOT NULL DEFAULT true,
  sort_order      INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS product_variant_sku_idx
  ON product_variant (sku) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS product_variant_product_idx ON product_variant (product_id, sort_order);

-- Axes are data, so the catalogue absorbs a change in what is sold.
CREATE TABLE IF NOT EXISTS variant_axis (
  code       STRING PRIMARY KEY,
  label      STRING NOT NULL,
  sort_order INT NOT NULL DEFAULT 0
);

INSERT INTO variant_axis (code, label, sort_order) VALUES
  ('colour', 'Colour', 1),
  ('size',   'Size',   2),
  ('model',  'Model',  3)
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS variant_value (
  variant_id UUID NOT NULL REFERENCES product_variant(id) ON DELETE CASCADE,
  axis_code  STRING NOT NULL REFERENCES variant_axis(code),
  value      STRING NOT NULL,
  PRIMARY KEY (variant_id, axis_code)
);

CREATE INDEX IF NOT EXISTS variant_value_axis_idx ON variant_value (axis_code, value);

-- ---------------------------------------------------------------------------
-- Stock as an append-only ledger. Quantity is a sum, never a mutated counter:
-- under serializable isolation a read-modify-write counter is a live bug, and
-- the ledger gives a full stock history for free.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS stock_entry (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id  UUID NOT NULL REFERENCES product_variant(id) ON DELETE CASCADE,
  delta       INT NOT NULL,
  reason      STRING NOT NULL CHECK (
                reason IN ('received', 'sold', 'returned', 'adjustment', 'damaged', 'reserved', 'released')
              ),
  note        STRING,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor_id    UUID REFERENCES staff(id),
  order_id    UUID
);

CREATE INDEX IF NOT EXISTS stock_entry_variant_idx ON stock_entry (variant_id, occurred_at DESC);

-- ---------------------------------------------------------------------------
-- Media. R2 keys with intrinsic dimensions, so every image reserves its box and
-- contributes nothing to CLS.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS product_media (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES product(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES product_variant(id) ON DELETE SET NULL,
  r2_key     STRING NOT NULL,
  kind       STRING NOT NULL DEFAULT 'image' CHECK (kind IN ('image', 'video')),
  alt        STRING,
  width      INT,
  height     INT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS product_media_product_idx ON product_media (product_id, sort_order);
