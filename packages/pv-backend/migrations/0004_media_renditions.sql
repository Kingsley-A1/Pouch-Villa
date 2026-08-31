-- Media renditions and upload staging.
--
-- 0003 gave product_media a single r2_key. A product image is really a set of
-- renditions (thumb/card/hero) sharing one content hash, so the row records the
-- hash and the widths that exist; the key for any one rendition is derived from
-- them rather than stored three times.

ALTER TABLE product_media ADD COLUMN IF NOT EXISTS content_hash STRING;
ALTER TABLE product_media ADD COLUMN IF NOT EXISTS byte_size INT;
ALTER TABLE product_media ADD COLUMN IF NOT EXISTS uploaded_by UUID REFERENCES staff(id);

-- An upload is staged before it is trusted: the browser PUTs bytes straight to
-- R2, then the server fetches them back, checks the magic bytes, strips EXIF and
-- builds the derivatives. A staged row that never gets finalised is rubbish to
-- be swept up, and must never be mistaken for live media.
CREATE TABLE IF NOT EXISTS media_upload (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id    UUID NOT NULL REFERENCES product(id) ON DELETE CASCADE,
  staging_key   STRING NOT NULL UNIQUE,
  status        STRING NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'finalised', 'rejected')),
  reject_reason STRING,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by    UUID REFERENCES staff(id),
  finalised_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS media_upload_product_idx ON media_upload (product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS media_upload_sweep_idx ON media_upload (status, created_at);
