-- The third role is called Staff, not Employee.
--
-- The client's own vocabulary: their three levels are CEO, Manager and Staff.
-- The label was the easy half; this renames the role *code* too, because leaving
-- 'EMPLOYEE' underneath a screen that says "Staff" means every future engineer
-- has to hold a translation in their head, and AGENTS.md section 7 is explicit
-- that names say what a thing is.
--
-- `staff_role.code` is a primary key that three tables reference, so this cannot
-- be an UPDATE in place — a parent key cannot change under live children. The
-- order below is the safe one: create the new role, copy its grants, repoint
-- every child, then retire the old role.
--
-- No session is invalidated. A staff member's role is read from their row on each
-- request rather than baked into their cookie, so an account moves the moment its
-- `role_code` does.

-- Rank 4, not 3, because rank is UNIQUE and EMPLOYEE still holds 3 at this point.
-- It is only ever an ORDER BY, so CEO(1), MANAGER(2), STAFF(4) sorts exactly as
-- intended and the gap costs nothing. Closing it would need a second UPDATE for
-- no benefit.
INSERT INTO staff_role (code, label, rank, is_protected)
VALUES ('STAFF', 'Staff', 4, false)
ON CONFLICT (code) DO NOTHING;

-- Copied, not re-derived from a hardcoded list: whatever the CEO had granted the
-- old role at runtime is what the renamed role must still have. Re-seeding from
-- 0002's defaults here would silently revoke every permission change they made.
INSERT INTO role_permission (role_code, permission_code)
SELECT 'STAFF', permission_code FROM role_permission WHERE role_code = 'EMPLOYEE'
ON CONFLICT (role_code, permission_code) DO NOTHING;

UPDATE staff SET role_code = 'STAFF' WHERE role_code = 'EMPLOYEE';

-- Unredeemed codes move too. A code minted yesterday for an Employee must still
-- work today and must create a Staff account when it does.
UPDATE staff_role_code SET role_code = 'STAFF' WHERE role_code = 'EMPLOYEE';

-- Last, once nothing references it. `role_permission` cascades; `staff` and
-- `staff_role_code` were repointed above, so this fails loudly rather than
-- orphaning anything if either UPDATE did not take.
DELETE FROM staff_role WHERE code = 'EMPLOYEE';
