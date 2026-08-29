-- Identity, access control, customers and settings.
--
-- Conventions, per AGENTS.md §3 and §6:
--   * UUID primary keys. A sequential integer creates a write hotspot on one range.
--   * TIMESTAMPTZ everywhere, stored UTC, rendered in Africa/Lagos.
--   * Money is an integer count of kobo. Never a float.
--   * Nothing is hard-deleted; rows carry deleted_at with an actor and reason.

-- ---------------------------------------------------------------------------
-- Access control. Three levels and no more: CEO, MANAGER, EMPLOYEE.
-- Permissions are rows the CEO edits at runtime, not a compile-time map.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS staff_role (
  code        STRING PRIMARY KEY,
  label       STRING NOT NULL,
  rank        INT NOT NULL UNIQUE,
  -- The CEO role cannot be edited, demoted or deleted, by anyone, including itself.
  is_protected BOOL NOT NULL DEFAULT false
);

INSERT INTO staff_role (code, label, rank, is_protected) VALUES
  ('CEO',      'CEO',      1, true),
  ('MANAGER',  'Manager',  2, false),
  ('EMPLOYEE', 'Employee', 3, false)
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS permission (
  code        STRING PRIMARY KEY,
  description STRING NOT NULL
);

CREATE TABLE IF NOT EXISTS role_permission (
  role_code       STRING NOT NULL REFERENCES staff_role(code) ON DELETE CASCADE,
  permission_code STRING NOT NULL REFERENCES permission(code) ON DELETE CASCADE,
  granted_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  granted_by      UUID,
  PRIMARY KEY (role_code, permission_code)
);

CREATE INDEX IF NOT EXISTS role_permission_permission_idx
  ON role_permission (permission_code);

-- ---------------------------------------------------------------------------
-- Staff. Separate table, separate session, separate code path from customers.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS staff (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email          STRING NOT NULL,
  full_name      STRING NOT NULL,
  role_code      STRING NOT NULL REFERENCES staff_role(code),
  -- Null for an account that only ever signs in with Google.
  password_hash  STRING,
  google_subject STRING,
  email_verified_at TIMESTAMPTZ,
  totp_secret    STRING,
  status         STRING NOT NULL DEFAULT 'active'
                 CHECK (status IN ('active', 'suspended')),
  last_login_at  TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at     TIMESTAMPTZ,
  deleted_by     UUID,
  deleted_reason STRING
);

CREATE UNIQUE INDEX IF NOT EXISTS staff_email_active_idx
  ON staff (email) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS staff_google_subject_idx
  ON staff (google_subject) WHERE google_subject IS NOT NULL;
CREATE INDEX IF NOT EXISTS staff_role_idx ON staff (role_code);

-- ---------------------------------------------------------------------------
-- Role codes. The only way a staff account comes into existence.
--
-- One code per access level. Nothing is seeded, so there is no standing identity
-- to guess; the first CEO code is minted by an audited command. Only the hash is
-- stored, so a database read does not hand over a working code.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS staff_role_code (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code_hash    STRING NOT NULL UNIQUE,
  role_code    STRING NOT NULL REFERENCES staff_role(code),
  label        STRING,
  max_uses     INT NOT NULL DEFAULT 1 CHECK (max_uses > 0),
  used_count   INT NOT NULL DEFAULT 0 CHECK (used_count >= 0),
  expires_at   TIMESTAMPTZ NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by   UUID REFERENCES staff(id),
  revoked_at   TIMESTAMPTZ,
  revoked_by   UUID REFERENCES staff(id)
);

CREATE INDEX IF NOT EXISTS staff_role_code_role_idx ON staff_role_code (role_code);

CREATE TABLE IF NOT EXISTS staff_role_code_redemption (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_code_id UUID NOT NULL REFERENCES staff_role_code(id),
  staff_id     UUID NOT NULL REFERENCES staff(id),
  redeemed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  request_id   STRING
);

CREATE INDEX IF NOT EXISTS staff_role_code_redemption_code_idx
  ON staff_role_code_redemption (role_code_id);

-- Email verification for staff is code-based, never a link.
CREATE TABLE IF NOT EXISTS staff_email_code (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id   UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  code_hash  STRING NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  attempts   INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS staff_email_code_staff_idx ON staff_email_code (staff_id);

-- ---------------------------------------------------------------------------
-- Staff sessions. Server-side and revocable: firing someone must end their
-- access immediately, which a stateless JWT cannot do.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS staff_session (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id       UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  token_hash     STRING NOT NULL UNIQUE,
  issued_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  absolute_expires_at TIMESTAMPTZ NOT NULL,
  revoked_at     TIMESTAMPTZ,
  revoked_reason STRING,
  ip             STRING,
  user_agent     STRING
);

CREATE INDEX IF NOT EXISTS staff_session_staff_idx ON staff_session (staff_id);

-- ---------------------------------------------------------------------------
-- Customers. A separate identity system sharing no table or code path with staff.
-- Created at order time from the "Create my Pouch Villa Account" checkbox.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS customer (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email           STRING NOT NULL,
  full_name       STRING,
  phone           STRING,
  password_hash   STRING,
  google_subject  STRING,
  -- Customers are not email-verified. This records consent, not verification:
  -- which checkbox created the account, and when.
  account_source  STRING NOT NULL DEFAULT 'checkout'
                  CHECK (account_source IN ('checkout', 'self_signup', 'staff_created')),
  consented_at    TIMESTAMPTZ,
  status          STRING NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active', 'suspended')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ,
  deleted_by      UUID,
  deleted_reason  STRING
);

CREATE UNIQUE INDEX IF NOT EXISTS customer_email_active_idx
  ON customer (email) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS customer_google_subject_idx
  ON customer (google_subject) WHERE google_subject IS NOT NULL;

CREATE TABLE IF NOT EXISTS customer_session (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id    UUID NOT NULL REFERENCES customer(id) ON DELETE CASCADE,
  token_hash     STRING NOT NULL UNIQUE,
  issued_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  absolute_expires_at TIMESTAMPTZ NOT NULL,
  revoked_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS customer_session_customer_idx ON customer_session (customer_id);

-- ---------------------------------------------------------------------------
-- Settings. The single source of truth for every business fact.
--
-- An environment variable may SEED a setting on first run, but once a value is
-- present in this table the table wins. That is what keeps env and admin in
-- synergy rather than being two competing sources: env bootstraps, admin owns.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS setting (
  key          STRING PRIMARY KEY,
  value        STRING,
  -- Where the current value came from, so the admin UI can show "seeded from
  -- environment" versus "set by a person" rather than pretending they are alike.
  origin       STRING NOT NULL DEFAULT 'unset'
               CHECK (origin IN ('unset', 'environment', 'admin')),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by   UUID REFERENCES staff(id)
);

-- ---------------------------------------------------------------------------
-- Delivery zones. Admin-managed CRUD; fees are integer kobo.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS delivery_zone (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           STRING NOT NULL,
  lga            STRING,
  fee_kobo       INT NOT NULL CHECK (fee_kobo >= 0),
  min_days       INT CHECK (min_days >= 0),
  max_days       INT CHECK (max_days >= 0),
  is_active      BOOL NOT NULL DEFAULT true,
  sort_order     INT NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at     TIMESTAMPTZ,
  deleted_by     UUID REFERENCES staff(id),
  deleted_reason STRING,
  CONSTRAINT delivery_zone_days_ordered CHECK (max_days IS NULL OR min_days IS NULL OR max_days >= min_days)
);

CREATE INDEX IF NOT EXISTS delivery_zone_active_idx
  ON delivery_zone (is_active, sort_order) WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- Audit. Append-only: every privileged mutation, with before and after.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS audit_event (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor_type   STRING NOT NULL CHECK (actor_type IN ('staff', 'customer', 'system')),
  actor_id     UUID,
  action       STRING NOT NULL,
  entity_type  STRING NOT NULL,
  entity_id    STRING,
  before       JSONB,
  after        JSONB,
  request_id   STRING,
  ip           STRING
);

CREATE INDEX IF NOT EXISTS audit_event_entity_idx ON audit_event (entity_type, entity_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS audit_event_actor_idx ON audit_event (actor_type, actor_id, occurred_at DESC);
