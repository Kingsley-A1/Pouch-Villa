-- How a home-page section is laid out, as data.
--
-- `0009_storefront` made *what* a section shows a runtime decision — a category
-- rule, a brand rule, or a hand-picked collection. It left *how* it looks fixed:
-- every section rendered as the same grid under the same heading, so a page with
-- three sections read as one long undifferentiated wall of cards.
--
-- Layout belongs in the same place as kind, for the same reason. A shop
-- merchandises a premium line differently from a workhorse line, and which
-- treatment suits which line is a merchandising judgement the CEO makes and
-- changes — not something an engineer should have settled at deploy time.
--
-- Three treatments, deliberately few. Each has to earn its place by being
-- genuinely distinct at a glance; a picker with eight near-identical options is
-- a way of not deciding.
--
--   grid    The default. An even grid under a left-aligned heading.
--   feature The first product leads at double size, the rest fill beside it.
--           Editorial. Suits a small, considered range where one piece can
--           carry the section.
--   band    A tinted full-bleed band, heading in its own column beside the
--           products. Suits a broad utilitarian range, and breaks up a long
--           page of otherwise-white sections.
--
-- `grid` is the default, so every existing row keeps exactly the appearance it
-- has today and this migration changes nothing visible on its own.

ALTER TABLE home_section
  ADD COLUMN IF NOT EXISTS layout STRING NOT NULL DEFAULT 'grid';

-- Added separately from the column: CockroachDB applies a NOT NULL default to
-- existing rows first, so the constraint is guaranteed to find every row already
-- holding a legal value.
ALTER TABLE home_section
  ADD CONSTRAINT home_section_layout_known
  CHECK (layout IN ('grid', 'feature', 'band'));
