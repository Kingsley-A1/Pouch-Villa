import type { StaffRole } from "../domain/types";

export type Permission =
  | "dashboard"
  | "products"
  | "compatibility"
  | "inventory"
  | "reservations"
  | "collections"
  | "enquiries"
  | "case_requests"
  | "customers"
  | "media"
  | "content"
  | "settings"
  | "staff"
  | "analytics"
  | "audit";

const permissions: Record<StaffRole, Permission[]> = {
  owner: [
    "dashboard",
    "products",
    "compatibility",
    "inventory",
    "reservations",
    "collections",
    "enquiries",
    "case_requests",
    "customers",
    "media",
    "content",
    "settings",
    "staff",
    "analytics",
    "audit",
  ],
  manager: [
    "dashboard",
    "products",
    "compatibility",
    "inventory",
    "reservations",
    "collections",
    "enquiries",
    "case_requests",
    "customers",
    "media",
    "content",
    "settings",
    "analytics",
    "audit",
  ],
  catalogue: ["dashboard", "products", "compatibility", "inventory", "collections", "media"],
  support: ["dashboard", "reservations", "enquiries", "case_requests", "customers"],
  viewer: ["dashboard", "analytics"],
};

export function can(role: StaffRole, permission: Permission) {
  return permissions[role].includes(permission);
}
export function permissionsFor(role: StaffRole) {
  return permissions[role];
}
