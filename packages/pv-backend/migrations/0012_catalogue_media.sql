-- A photograph for a category, and a logo for a brand.
--
-- The CEO's browse path is category -> brand -> model -> product, and the first
-- two steps are meant to be carried by pictures: a lifestyle photograph on the
-- category tile, the maker's logo on the brand card. Neither table had anywhere
-- to put one. A category tile has been borrowing the newest published product's
-- cut-out through a LEFT JOIN LATERAL, which is why a wall of them reads as a
-- catalogue page rather than as a shop front, and a brand had no image at all.
--
-- One image each, not a gallery. A category has a photograph and a brand has a
-- logo, both singular, so the uniqueness is expressed as a partial unique index
-- rather than left to the application to remember. That is also why this is not
-- product_media: that table carries sort order, a variant reference and a
-- kind, all of which would be dead columns here.
--
-- Owner is one of two nullable references rather than a (kind, id) pair, so the
-- database keeps referential integrity and a deleted category takes its
-- photograph with it. The same shape home_section already uses for its own
-- category/brand reference.

CREATE TABLE IF NOT EXISTS catalogue_media (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  category_id  UUID REFERENCES category(id) ON DELETE CASCADE,
  brand_id     UUID REFERENCES brand(id) ON DELETE CASCADE,

  -- The card rendition's key. The others are derived from the hash, exactly as
  -- product_media does it, so a rendition set is never stored three times.
  r2_key       STRING NOT NULL,
  content_hash STRING NOT NULL,

  -- Intrinsic dimensions, so every image renders into a reserved box and
  -- contributes nothing to CLS (AGENTS.md section 8).
  width        INT NOT NULL,
  height       INT NOT NULL,
  byte_size    INT,
  alt          STRING,

  uploaded_by  UUID REFERENCES staff(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT catalogue_media_one_owner CHECK (
    (category_id IS NOT NULL AND brand_id IS NULL)
    OR (category_id IS NULL AND brand_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS catalogue_media_category_idx
  ON catalogue_media (category_id) WHERE category_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS catalogue_media_brand_idx
  ON catalogue_media (brand_id) WHERE brand_id IS NOT NULL;

-- The staging table learns about the other two owners.
--
-- An upload is staged before it is trusted — the browser PUTs to R2, the server
-- fetches the bytes back, checks the magic bytes, strips EXIF and builds the
-- derivatives — and that is worth doing for a brand logo for exactly the same
-- reasons it is worth doing for a product photograph. Reusing the row means
-- reusing that pipeline rather than writing a second, weaker one.
--
-- product_id loses its NOT NULL because a staged category image has no product.
-- The "exactly one owner" rule is enforced in services/catalogue-media.ts rather
-- than as a CHECK here: neither Postgres nor CockroachDB accepts
-- ADD CONSTRAINT IF NOT EXISTS, and migrations.test.ts requires every statement
-- in a new migration to be safe to replay. The only writers are two service
-- functions, both of which set exactly one.

ALTER TABLE media_upload ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES category(id) ON DELETE CASCADE;
ALTER TABLE media_upload ADD COLUMN IF NOT EXISTS brand_id UUID REFERENCES brand(id) ON DELETE CASCADE;
ALTER TABLE media_upload ALTER COLUMN product_id DROP NOT NULL;
