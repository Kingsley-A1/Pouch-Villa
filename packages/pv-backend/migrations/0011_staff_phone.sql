-- A staff member's own contact number, so they have a profile to edit.
--
-- The admin had no equivalent of the customer's "Your details" screen: a person
-- who joined with a mistyped name, or who married and changed it, had to ask
-- someone with staff.manage to correct a row about themselves. Name and password
-- were already columns; a phone number was the one field the customer profile
-- has and this one did not.
--
-- Stored twice, exactly as `customer` does it. `phone` keeps what was typed so
-- it can be shown back to the person who typed it; `phone_normalised` is the
-- E.164 form the application compares and searches on. The same number can be
-- written with a country code, with a leading zero, or with spaces between the
-- groups, and only one of those shapes can be matched reliably.
--
-- Nullable, and no default. §0 rule 2: an account with no number recorded has no
-- number, and must not render an empty string where a phone number belongs.

ALTER TABLE staff ADD COLUMN IF NOT EXISTS phone STRING;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS phone_normalised STRING;
