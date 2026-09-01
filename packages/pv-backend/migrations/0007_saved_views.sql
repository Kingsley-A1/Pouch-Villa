-- Saved views for the admin lists.
--
-- Phase 4. The admin screens filter by status through the query string, and the
-- filters staff actually use are a small, stable set they return to every day —
-- "receipts to check", "paid, not yet prepared", "reviews waiting". Retyping or
-- re-navigating to those is the friction that makes an admin feel slow even when
-- every page is fast.
--
-- A view is **the query string, not the results**. Storing a query means a saved
-- view is always current and costs nothing to keep; storing ids would go stale
-- the moment an order moved.
--
-- Personal by default. `is_shared` promotes one to the whole team, which is how
-- the CEO standardises how the shop is run without taking away anyone's own
-- shortcuts.

CREATE TABLE IF NOT EXISTS saved_view (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id   UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,

  -- Which admin list it belongs to. A closed set, checked here as well as in
  -- code so a stray value cannot make a view that renders nowhere.
  screen     STRING NOT NULL CHECK (
               screen IN ('orders', 'payments', 'reviews', 'contact', 'products')
             ),
  name       STRING NOT NULL,
  -- The query string without its leading '?', e.g. "status=awaiting_payment".
  query      STRING NOT NULL,

  is_shared  BOOL NOT NULL DEFAULT false,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The list read: everything this staff member owns, plus everything shared.
CREATE INDEX IF NOT EXISTS saved_view_owner_idx ON saved_view (staff_id, screen, sort_order);
CREATE INDEX IF NOT EXISTS saved_view_shared_idx ON saved_view (screen, sort_order) WHERE is_shared;

-- One name per screen per person, so saving twice updates rather than
-- accumulating duplicates that all look identical in the bar.
CREATE UNIQUE INDEX IF NOT EXISTS saved_view_unique_name_idx
  ON saved_view (staff_id, screen, name);
