-- Device classes: the tier between a make and a model.
--
-- Devices hung straight off a brand, so Apple's models were one flat list with
-- iPhones and iPads in it together. That is fine at five models and unreadable
-- at thirty, and it gave the shop no way to say "iPad cases" as a thing.
--
-- A separate table rather than a `line` label on the device, because a class is
-- addressable: it wants its own slug so `/browse/pouches/apple/ipad` can be a
-- real URL a customer shares, its own sort order so the CEO decides whether
-- iPhone or iPad leads, and somewhere for a photograph to hang later. A text
-- column gives none of that and turns every rename into a data migration.
--
-- **Optional, per brand.** `device.line_id` is nullable and no brand is required
-- to have any. A brand with no classes renders exactly as it does today — its
-- models flat — because the storefront groups only where there is a grouping,
-- and a class level nobody filled in must not become an empty step.

CREATE TABLE IF NOT EXISTS device_line (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id       UUID NOT NULL REFERENCES brand(id),
  name           STRING NOT NULL,
  slug           STRING NOT NULL,
  sort_order     INT NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by     UUID REFERENCES staff(id),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by     UUID REFERENCES staff(id),
  deleted_at     TIMESTAMPTZ,
  deleted_by     UUID REFERENCES staff(id),
  deleted_reason STRING
);

-- Scoped to the brand, not global: "Tab" under Samsung and "Tab" under another
-- make are different classes and must both be allowed to exist.
CREATE UNIQUE INDEX IF NOT EXISTS device_line_brand_slug_idx
  ON device_line (brand_id, slug) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS device_line_brand_order_idx ON device_line (brand_id, sort_order);

-- Nullable on purpose. Every device that exists today keeps working, unfiled,
-- and staff sort them into classes when they choose to rather than being made
-- to before they can save anything.
ALTER TABLE device ADD COLUMN IF NOT EXISTS line_id UUID REFERENCES device_line(id);

CREATE INDEX IF NOT EXISTS device_line_idx ON device (line_id, sort_order);
