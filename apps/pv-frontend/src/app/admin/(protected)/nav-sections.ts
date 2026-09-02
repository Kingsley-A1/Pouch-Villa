import type { PermissionCode } from "@pv/backend/auth/permission-codes";

export type NavSection = { label: string; href: string; permission: PermissionCode };

/**
 * One row per admin section from the signed scope §3, each gated by the
 * permission that makes it meaningful to show at all. A section a role cannot
 * act on is not merely disabled — it never appears, so the nav itself reflects
 * what a role can actually do.
 */
export const NAV_SECTIONS: NavSection[] = [
  { label: "Dashboard", href: "/admin", permission: "dashboard.view" },
  { label: "Products", href: "/admin/products", permission: "product.view" },
  { label: "Storefront", href: "/admin/storefront", permission: "product.manage" },
  { label: "Brands & Categories", href: "/admin/categories", permission: "category.manage" },
  { label: "Devices", href: "/admin/devices", permission: "category.manage" },
  { label: "Delivery Zones", href: "/admin/delivery", permission: "delivery.manage" },
  { label: "Orders", href: "/admin/orders", permission: "order.view" },
  { label: "Payments & Proofs", href: "/admin/payments", permission: "payment.view" },
  { label: "Customers", href: "/admin/customers", permission: "customer.view" },
  { label: "Reviews", href: "/admin/reviews", permission: "review.moderate" },
  { label: "Contact Requests", href: "/admin/contact", permission: "enquiry.manage" },
  { label: "Staff", href: "/admin/staff", permission: "staff.view" },
  { label: "Roles & Permissions", href: "/admin/roles", permission: "role.manage" },
  { label: "Settings", href: "/admin/settings", permission: "settings.view" },
];
