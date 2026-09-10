-- Two kinds of thing in one shop.
--
-- A pouch is defined by what it fits: you choose a make, then a model, and the
-- shop shows what goes on it. An accessory is defined by what it *is* — a power
-- bank is a power bank whatever phone you own — so asking a buyer which device
-- it is for is asking the wrong question, and asking the admin for a brand and a
-- device class when filing one is three fields nobody can answer.
--
-- The distinction is a property of the section, so it lives on the top-level
-- category and the CEO owns it. It is deliberately NOT a check on the category's
-- name: AGENTS.md section 4 forbids a category list in source, and a rule reading
-- `name = 'Accessories'` would break the day they rename it — which is exactly
-- the kind of business fact that must stay editable.
--
-- Default true, so every category that exists today keeps behaving as it does:
-- brand, class and device fit. The client unticks it on Accessories, once.

ALTER TABLE category
  ADD COLUMN IF NOT EXISTS fits_devices BOOL NOT NULL DEFAULT true;

-- Children inherit from their top-level ancestor rather than carrying their own
-- answer. "Screen Protectors" is not separately a device-fitting section; it is
-- part of one, and letting a child disagree with its parent would produce a tree
-- the storefront cannot render consistently. The service reads the flag from the
-- root and the admin only offers the control there.
