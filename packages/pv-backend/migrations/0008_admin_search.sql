-- Derived, permission-scoped admin search documents.
--
-- This table is not business truth. It contains only the minimum display and
-- matching fields needed by the admin command search and can be rebuilt from
-- the canonical tables. Secrets, financial-document locations, setting values,
-- enquiry messages, review bodies and audit payloads are deliberately absent.

CREATE TABLE IF NOT EXISTS admin_search_document (
  entity_type STRING NOT NULL CHECK (
    entity_type IN (
      'product', 'order', 'customer', 'payment', 'brand', 'category',
      'device', 'staff', 'review', 'enquiry', 'delivery_zone', 'setting'
    )
  ),
  entity_id STRING NOT NULL,
  title STRING NOT NULL,
  context STRING,
  search_text STRING NOT NULL,
  required_permission STRING NOT NULL REFERENCES permission(code),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  search_vector TSVECTOR AS (to_tsvector('simple', search_text)) STORED,
  PRIMARY KEY (entity_type, entity_id)
);

CREATE INVERTED INDEX IF NOT EXISTS admin_search_document_vector_idx
  ON admin_search_document (search_vector);

CREATE INDEX IF NOT EXISTS admin_search_document_title_trgm_idx
  ON admin_search_document USING GIN (title gin_trgm_ops);

CREATE INDEX IF NOT EXISTS admin_search_document_permission_idx
  ON admin_search_document (required_permission, entity_type);

-- Existing rows are useful immediately after migration. Every statement is an
-- idempotent projection from canonical data and may safely be repeated.

INSERT INTO admin_search_document
  (entity_type, entity_id, title, context, search_text, required_permission)
SELECT 'product', p.id::STRING, p.name, p.status,
       concat_ws(' ', p.name, p.slug,
         (SELECT string_agg(v.sku, ' ') FROM product_variant v
           WHERE v.product_id = p.id AND v.deleted_at IS NULL)),
       'product.view'
  FROM product p
 WHERE p.deleted_at IS NULL
ON CONFLICT (entity_type, entity_id) DO UPDATE SET
  title = excluded.title,
  context = excluded.context,
  search_text = excluded.search_text,
  required_permission = excluded.required_permission,
  updated_at = now();

INSERT INTO admin_search_document
  (entity_type, entity_id, title, context, search_text, required_permission)
SELECT 'order', o.id::STRING, o.reference, o.status,
       concat_ws(' ', o.reference, o.contact_name, o.contact_email, o.contact_phone),
       'order.view'
  FROM customer_order o
 WHERE o.deleted_at IS NULL
ON CONFLICT (entity_type, entity_id) DO UPDATE SET
  title = excluded.title,
  context = excluded.context,
  search_text = excluded.search_text,
  required_permission = excluded.required_permission,
  updated_at = now();

INSERT INTO admin_search_document
  (entity_type, entity_id, title, context, search_text, required_permission)
SELECT 'customer', c.id::STRING, coalesce(c.full_name, c.email), c.email,
       concat_ws(' ', c.full_name, c.email, c.phone), 'customer.view'
  FROM customer c
 WHERE c.deleted_at IS NULL
ON CONFLICT (entity_type, entity_id) DO UPDATE SET
  title = excluded.title,
  context = excluded.context,
  search_text = excluded.search_text,
  required_permission = excluded.required_permission,
  updated_at = now();

INSERT INTO admin_search_document
  (entity_type, entity_id, title, context, search_text, required_permission)
SELECT 'payment', p.id::STRING, o.reference, p.status,
       concat_ws(' ', o.reference, p.status), 'payment.view'
  FROM payment p
  JOIN customer_order o ON o.id = p.order_id
 WHERE o.deleted_at IS NULL
ON CONFLICT (entity_type, entity_id) DO UPDATE SET
  title = excluded.title,
  context = excluded.context,
  search_text = excluded.search_text,
  required_permission = excluded.required_permission,
  updated_at = now();

INSERT INTO admin_search_document
  (entity_type, entity_id, title, context, search_text, required_permission)
SELECT 'brand', b.id::STRING, b.name,
       CASE WHEN b.is_active THEN 'Visible' ELSE 'Hidden' END,
       concat_ws(' ', b.name, b.slug), 'category.manage'
  FROM brand b
 WHERE b.deleted_at IS NULL
ON CONFLICT (entity_type, entity_id) DO UPDATE SET
  title = excluded.title,
  context = excluded.context,
  search_text = excluded.search_text,
  required_permission = excluded.required_permission,
  updated_at = now();

INSERT INTO admin_search_document
  (entity_type, entity_id, title, context, search_text, required_permission)
SELECT 'category', c.id::STRING, c.name,
       CASE WHEN c.is_active THEN 'Visible' ELSE 'Hidden' END,
       concat_ws(' ', c.name, c.slug), 'category.manage'
  FROM category c
 WHERE c.deleted_at IS NULL
ON CONFLICT (entity_type, entity_id) DO UPDATE SET
  title = excluded.title,
  context = excluded.context,
  search_text = excluded.search_text,
  required_permission = excluded.required_permission,
  updated_at = now();

INSERT INTO admin_search_document
  (entity_type, entity_id, title, context, search_text, required_permission)
SELECT 'device', d.id::STRING, concat_ws(' ', b.name, d.name),
       CASE WHEN d.released_year IS NULL THEN NULL ELSE d.released_year::STRING END,
       concat_ws(' ', b.name, d.name, d.slug, d.released_year::STRING), 'category.manage'
  FROM device d
  JOIN brand b ON b.id = d.brand_id
 WHERE b.deleted_at IS NULL
ON CONFLICT (entity_type, entity_id) DO UPDATE SET
  title = excluded.title,
  context = excluded.context,
  search_text = excluded.search_text,
  required_permission = excluded.required_permission,
  updated_at = now();

INSERT INTO admin_search_document
  (entity_type, entity_id, title, context, search_text, required_permission)
SELECT 'staff', s.id::STRING, s.full_name, concat_ws(' · ', s.role_code, s.status),
       concat_ws(' ', s.full_name, s.email, s.role_code), 'staff.view'
  FROM staff s
 WHERE s.deleted_at IS NULL
ON CONFLICT (entity_type, entity_id) DO UPDATE SET
  title = excluded.title,
  context = excluded.context,
  search_text = excluded.search_text,
  required_permission = excluded.required_permission,
  updated_at = now();

INSERT INTO admin_search_document
  (entity_type, entity_id, title, context, search_text, required_permission)
SELECT 'review', r.id::STRING, coalesce(r.title, concat('Review by ', r.author_name)),
       concat_ws(' · ', p.name, r.status),
       concat_ws(' ', r.author_name, r.author_email, r.title, p.name, o.reference),
       'review.moderate'
  FROM review r
  JOIN product p ON p.id = r.product_id
  LEFT JOIN order_line ol ON ol.id = r.order_line_id
  LEFT JOIN customer_order o ON o.id = ol.order_id
 WHERE r.deleted_at IS NULL
ON CONFLICT (entity_type, entity_id) DO UPDATE SET
  title = excluded.title,
  context = excluded.context,
  search_text = excluded.search_text,
  required_permission = excluded.required_permission,
  updated_at = now();

INSERT INTO admin_search_document
  (entity_type, entity_id, title, context, search_text, required_permission)
SELECT 'enquiry', e.id::STRING, e.name, concat_ws(' · ', e.subject, e.status),
       concat_ws(' ', e.name, e.email, e.phone, e.subject, e.order_reference),
       'enquiry.manage'
  FROM contact_request e
 WHERE e.deleted_at IS NULL
ON CONFLICT (entity_type, entity_id) DO UPDATE SET
  title = excluded.title,
  context = excluded.context,
  search_text = excluded.search_text,
  required_permission = excluded.required_permission,
  updated_at = now();

INSERT INTO admin_search_document
  (entity_type, entity_id, title, context, search_text, required_permission)
SELECT 'delivery_zone', z.id::STRING, z.name,
       CASE WHEN z.is_active THEN 'Active' ELSE 'Inactive' END,
       concat_ws(' ', z.name, z.lga), 'delivery.manage'
  FROM delivery_zone z
 WHERE z.deleted_at IS NULL
ON CONFLICT (entity_type, entity_id) DO UPDATE SET
  title = excluded.title,
  context = excluded.context,
  search_text = excluded.search_text,
  required_permission = excluded.required_permission,
  updated_at = now();

INSERT INTO admin_search_document
  (entity_type, entity_id, title, context, search_text, required_permission)
SELECT 'setting', s.key, replace(s.key, '_', ' '), 'Setting',
       replace(s.key, '_', ' '), 'settings.view'
  FROM setting s
ON CONFLICT (entity_type, entity_id) DO UPDATE SET
  title = excluded.title,
  context = excluded.context,
  search_text = excluded.search_text,
  required_permission = excluded.required_permission,
  updated_at = now();
