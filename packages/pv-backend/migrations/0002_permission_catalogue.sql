-- The permission catalogue, and the default grants for each role.
--
-- The catalogue is code-defined because a permission only means something if a
-- service checks it; inventing one at runtime would grant nothing. The *grants*
-- are data, and the CEO edits them at runtime — that is the part the scope
-- requires and the part a compile-time map could never satisfy.

INSERT INTO permission (code, description) VALUES
  ('dashboard.view',        'See the admin dashboard'),
  ('product.view',          'View products and variants'),
  ('product.manage',        'Create, edit, publish and soft-delete products'),
  ('category.manage',       'Manage brands and categories'),
  ('media.manage',          'Upload and remove product media'),
  ('order.view',            'View orders and their history'),
  ('order.manage',          'Advance order status and edit orders'),
  ('payment.view',          'View payments and transfer proofs'),
  ('payment.confirm',       'Confirm or reject a payment proof'),
  ('customer.view',         'View customer accounts and purchase history'),
  ('customer.manage',       'Suspend, restore or soft-delete a customer'),
  ('review.moderate',       'Approve, reject and remove reviews'),
  ('enquiry.manage',        'View and handle contact requests'),
  ('delivery.manage',       'Manage delivery zones, fees and timeframes'),
  ('settings.view',         'View business settings'),
  ('settings.manage',       'Edit business settings, including bank details'),
  ('staff.view',            'View staff accounts'),
  ('staff.manage',          'Invite staff and manage their accounts'),
  ('role.manage',           'Change what managers and employees may do'),
  ('audit.view',            'Read the audit log')
ON CONFLICT (code) DO UPDATE SET description = excluded.description;

-- CEO holds everything, always. This is re-asserted on every migration run so a
-- newly added permission is never accidentally withheld from the CEO.
INSERT INTO role_permission (role_code, permission_code)
SELECT 'CEO', code FROM permission
ON CONFLICT (role_code, permission_code) DO NOTHING;

-- Manager: near-full access, as the scope describes, minus the controls that
-- would let a manager grant themselves more or alter the audit trail.
INSERT INTO role_permission (role_code, permission_code)
SELECT 'MANAGER', code FROM permission
 WHERE code NOT IN ('role.manage', 'staff.manage')
ON CONFLICT (role_code, permission_code) DO NOTHING;

-- Employee: day-to-day fulfilment. No money, no settings, no staff.
INSERT INTO role_permission (role_code, permission_code)
SELECT 'EMPLOYEE', code FROM permission
 WHERE code IN (
   'dashboard.view',
   'product.view',
   'order.view',
   'order.manage',
   'payment.view',
   'customer.view',
   'enquiry.manage'
 )
ON CONFLICT (role_code, permission_code) DO NOTHING;
