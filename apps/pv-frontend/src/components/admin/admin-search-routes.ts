import type { AdminSearchEntity } from "@pv/backend/services/admin-search";

export function adminSearchResultHref(entity: AdminSearchEntity, entityId: string): string | null {
  switch (entity) {
    case "product":
      return `/admin/products/${encodeURIComponent(entityId)}/edit`;
    case "order":
      return `/admin/orders/${encodeURIComponent(entityId)}`;
    case "customer":
      return "/admin/customers";
    case "payment":
      return "/admin/payments";
    case "brand":
    case "category":
      return "/admin/categories";
    case "device":
      return "/admin/devices";
    case "staff":
      return "/admin/staff";
    case "review":
      return "/admin/reviews";
    case "enquiry":
      return "/admin/contact";
    case "delivery_zone":
      return "/admin/delivery";
    case "setting":
      return "/admin/settings";
    default:
      return null;
  }
}

export function adminSearchEntityLabel(entity: AdminSearchEntity): string {
  return entity === "delivery_zone"
    ? "Delivery zones"
    : `${entity[0]?.toUpperCase() ?? ""}${entity.slice(1)}s`;
}
