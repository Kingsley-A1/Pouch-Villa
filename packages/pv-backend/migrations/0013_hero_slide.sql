-- The hero slide deck.
--
-- The client asked for the home page to open the way tomicase.com does: a
-- full-bleed photograph with a heavy headline over it, a Shop Now button, and
-- two or three of them on a timer. What sits there today is a headline and the
-- category cards, and no amount of restyling turns one into the other.
--
-- A slide is editorial, not taxonomy, which is why this is its own table rather
-- than a column on category. The reference's own slides are "Clearance Sales"
-- and "More" — neither is a category, and forcing them to be one would mean
-- creating fake categories to hold a banner and putting them in the shopper's
-- navigation as a side effect. Modelled on home_section instead: CEO-ordered,
-- active or not, soft-deleted, with an audit trail.
--
-- The image lives on the row rather than in catalogue_media. That table carries
-- a CHECK saying exactly one of category_id or brand_id is set, and neither
-- Postgres nor CockroachDB accepts ADD CONSTRAINT IF NOT EXISTS — so widening it
-- would mean a constraint this migration cannot replay safely. A slide has
-- exactly one photograph and it is definitionally part of the slide, so inline
-- columns are also the more honest shape.

CREATE TABLE IF NOT EXISTS hero_slide (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- The small line above the headline: "New in", "Clearance". Optional, because
  -- a slide that has nothing to say there should say nothing rather than a word
  -- we chose for it.
  kicker         STRING,
  headline       STRING NOT NULL,

  -- Where Shop Now goes. Any in-app path, so a slide can point at a category, a
  -- brand, a device filter or a single product without this table knowing what
  -- any of those are. Validated as a relative path in the service — an absolute
  -- URL here would let the admin turn the shop's own hero into an open redirect.
  href           STRING NOT NULL,
  cta_label      STRING,

  -- The photograph, as product_media stores one: the card key plus the hash the
  -- other renditions are derived from, and the intrinsic dimensions so the slide
  -- reserves its box and contributes nothing to CLS (AGENTS.md section 8).
  --
  -- Nullable, because a slide is created before its picture is chosen — the
  -- upload needs a row id to hang off. A slide with no image never renders.
  image_r2_key   STRING,
  image_hash     STRING,
  image_width    INT,
  image_height   INT,

  sort_order     INT NOT NULL DEFAULT 0,
  is_active      BOOL NOT NULL DEFAULT true,

  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by     UUID REFERENCES staff(id),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by     UUID REFERENCES staff(id),
  deleted_at     TIMESTAMPTZ,
  deleted_by     UUID REFERENCES staff(id),
  deleted_reason STRING
);

CREATE INDEX IF NOT EXISTS hero_slide_order_idx ON hero_slide (sort_order, id);

-- The staging table learns about the third owner, for the same reason it learned
-- about the first two: a hero photograph deserves the magic-byte check, the EXIF
-- strip and the derivative pipeline that every other uploaded image gets.
ALTER TABLE media_upload ADD COLUMN IF NOT EXISTS hero_slide_id UUID REFERENCES hero_slide(id) ON DELETE CASCADE;
