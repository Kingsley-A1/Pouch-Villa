-- Paying in the shop: cash, the POS terminal, or a transfer made at the counter.
--
-- The shop trades online and over a counter, and until now the platform only
-- modelled the first. Every order landed in `awaiting_payment` meaning "we are
-- waiting for your transfer", and a customer who chose to collect and pay on
-- arrival was shown a bank account and a receipt-upload box for money they had
-- no intention of sending. The order was fine; the screen was a lie.
--
-- Three columns, because there are three different facts and merging any two of
-- them loses something a till reconciliation needs:
--
--   payment_timing            when they pay — before collection, or at the counter
--   preferred_payment_method  what they said they would use, at checkout
--   payment.settled_method    what they actually used, recorded by the staff member
--
-- No new order status. `awaiting_payment` already means "the money has not
-- arrived", which is equally true of a transfer nobody has sent and a customer
-- who has not walked in yet. What changes is the sentence the customer reads,
-- and that is presentation, not state. A ninth status would have to be handled
-- in every switch that already exists, for no new behaviour.

-- Defaults chosen so every order already in the table keeps exactly the meaning
-- it has today: paid online, by transfer.
ALTER TABLE customer_order
  ADD COLUMN IF NOT EXISTS payment_timing STRING NOT NULL DEFAULT 'online'
  CHECK (payment_timing IN ('online', 'on_collection'));

ALTER TABLE customer_order
  ADD COLUMN IF NOT EXISTS preferred_payment_method STRING NOT NULL DEFAULT 'bank_transfer'
  CHECK (preferred_payment_method IN ('bank_transfer', 'cash', 'pos_card'));

-- When they said they would come. Optional — a customer who does not know is not
-- made to invent a time, and an absent answer renders as "not given" rather than
-- as a slot the shop will wait through.
--
-- TIMESTAMPTZ, not a string (AGENTS.md section 6). The browser collects a local
-- wall-clock time and the server resolves it against Africa/Lagos, so what is
-- stored is a real instant and staff in any timezone read the same moment.
ALTER TABLE customer_order
  ADD COLUMN IF NOT EXISTS preferred_pickup_at TIMESTAMPTZ;

-- "Who is coming in to pay, and when" — the counter queue's only query. Ordered
-- by the slot so the next arrival leads.
CREATE INDEX IF NOT EXISTS customer_order_counter_idx
  ON customer_order (payment_timing, status, preferred_pickup_at);

-- How the money actually arrived. NULL until somebody confirms it, which is the
-- honest state: an order awaiting payment has no settlement method, and a column
-- defaulted to 'bank_transfer' would claim otherwise for every unpaid order.
--
-- A new column rather than widening the CHECK on `payment.method`. That
-- constraint is unnamed and inline in 0006, so changing it needs DROP CONSTRAINT
-- + ADD CONSTRAINT — and `migrations.test.ts` bans a new ADD CONSTRAINT outright,
-- because neither engine accepts ADD CONSTRAINT IF NOT EXISTS and a migration
-- file must survive being replayed. Separating expectation from settlement is
-- also the shape we wanted anyway, so the constraint we could not change turned
-- out to be pointing at the better design.
ALTER TABLE payment
  ADD COLUMN IF NOT EXISTS settled_method STRING
  CHECK (settled_method IN ('bank_transfer', 'cash', 'pos_card'));

-- Who physically took the money, where that is a person at a counter rather than
-- a bank. Separate from `confirmed_by`, which records who marked the payment good
-- — usually the same person, but not when a manager confirms what a cashier took.
ALTER TABLE payment
  ADD COLUMN IF NOT EXISTS received_by UUID REFERENCES staff(id);

CREATE INDEX IF NOT EXISTS payment_received_by_idx ON payment (received_by);

-- Two rules this file cannot express and the service layer therefore owns:
--
--   * `payment_timing = 'on_collection'` requires `fulfilment = 'pickup'`.
--   * `preferred_pickup_at` is meaningless on a delivery order.
--
-- Both want a table-level CHECK, which is an ADD CONSTRAINT, which is banned
-- above. They are enforced in `placeOrder` and in the checkout schema, and
-- `counter-payment.test.ts` holds them there.
