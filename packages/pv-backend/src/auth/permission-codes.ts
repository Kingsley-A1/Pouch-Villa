/**
 * The permission catalogue. Kept in step with `migrations/0002_permission_catalogue.sql`
 * — a permission only means something where a service checks it, so the list of
 * what *can* be granted is code, while who *is* granted it is data the CEO edits.
 */
export const PERMISSIONS = [
  "dashboard.view",
  "product.view",
  "product.manage",
  "category.manage",
  "media.manage",
  "order.view",
  "order.manage",
  "payment.view",
  "payment.confirm",
  "customer.view",
  "customer.manage",
  "review.moderate",
  "enquiry.manage",
  "delivery.manage",
  "settings.view",
  "settings.manage",
  "staff.view",
  "staff.manage",
  "role.manage",
  "audit.view",
] as const;

export type PermissionCode = (typeof PERMISSIONS)[number];

export function isPermissionCode(value: string): value is PermissionCode {
  return (PERMISSIONS as readonly string[]).includes(value);
}

/**
 * Permissions no role but the CEO may ever hold, because holding one is
 * equivalent to holding all of them: whoever can edit grants can grant
 * themselves anything, and whoever can manage staff can create a CEO.
 */
export const CEO_ONLY_PERMISSIONS: readonly PermissionCode[] = ["role.manage", "staff.manage"];

export function isCeoOnly(permission: PermissionCode): boolean {
  return CEO_ONLY_PERMISSIONS.includes(permission);
}
