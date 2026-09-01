import type { PermissionCode } from "../auth/permission-codes";
import { type Queryable } from "../db/client";
import { withTransaction } from "../db/transaction";
import type { AdminSearchEntity } from "./admin-search";

type SearchDocumentRow = {
  title: string;
  context: string | null;
  search_text: string;
  required_permission: PermissionCode;
};

const PROJECTOR_SQL: Readonly<Record<AdminSearchEntity, string>> = {
  product: `SELECT p.name AS title, p.status AS context,
                   concat_ws(' ', p.name, p.slug,
                     (SELECT string_agg(v.sku, ' ') FROM product_variant v
                       WHERE v.product_id = p.id AND v.deleted_at IS NULL)) AS search_text,
                   'product.view' AS required_permission
              FROM product p WHERE p.id = $1 AND p.deleted_at IS NULL`,
  order: `SELECT o.reference AS title, o.status AS context,
                 concat_ws(' ', o.reference, o.contact_name, o.contact_email,
                   o.contact_phone) AS search_text,
                 'order.view' AS required_permission
            FROM customer_order o WHERE o.id = $1 AND o.deleted_at IS NULL`,
  customer: `SELECT coalesce(c.full_name, c.email) AS title, c.email AS context,
                    concat_ws(' ', c.full_name, c.email, c.phone) AS search_text,
                    'customer.view' AS required_permission
               FROM customer c WHERE c.id = $1 AND c.deleted_at IS NULL`,
  payment: `SELECT o.reference AS title, p.status AS context,
                   concat_ws(' ', o.reference, p.status) AS search_text,
                   'payment.view' AS required_permission
              FROM payment p JOIN customer_order o ON o.id = p.order_id
             WHERE p.id = $1 AND o.deleted_at IS NULL`,
  brand: `SELECT b.name AS title,
                 CASE WHEN b.is_active THEN 'Visible' ELSE 'Hidden' END AS context,
                 concat_ws(' ', b.name, b.slug) AS search_text,
                 'category.manage' AS required_permission
            FROM brand b WHERE b.id = $1 AND b.deleted_at IS NULL`,
  category: `SELECT c.name AS title,
                    CASE WHEN c.is_active THEN 'Visible' ELSE 'Hidden' END AS context,
                    concat_ws(' ', c.name, c.slug) AS search_text,
                    'category.manage' AS required_permission
               FROM category c WHERE c.id = $1 AND c.deleted_at IS NULL`,
  device: `SELECT concat_ws(' ', b.name, d.name) AS title,
                  CASE WHEN d.released_year IS NULL THEN NULL
                       ELSE d.released_year::STRING END AS context,
                  concat_ws(' ', b.name, d.name, d.slug,
                    d.released_year::STRING) AS search_text,
                  'category.manage' AS required_permission
             FROM device d JOIN brand b ON b.id = d.brand_id
            WHERE d.id = $1 AND b.deleted_at IS NULL`,
  staff: `SELECT s.full_name AS title,
                 concat_ws(' · ', s.role_code, s.status) AS context,
                 concat_ws(' ', s.full_name, s.email, s.role_code) AS search_text,
                 'staff.view' AS required_permission
            FROM staff s WHERE s.id = $1 AND s.deleted_at IS NULL`,
  review: `SELECT coalesce(r.title, concat('Review by ', r.author_name)) AS title,
                  concat_ws(' · ', p.name, r.status) AS context,
                  concat_ws(' ', r.author_name, r.author_email, r.title, p.name,
                    o.reference) AS search_text,
                  'review.moderate' AS required_permission
             FROM review r
             JOIN product p ON p.id = r.product_id
             LEFT JOIN order_line ol ON ol.id = r.order_line_id
             LEFT JOIN customer_order o ON o.id = ol.order_id
            WHERE r.id = $1 AND r.deleted_at IS NULL`,
  enquiry: `SELECT e.name AS title, concat_ws(' · ', e.subject, e.status) AS context,
                   concat_ws(' ', e.name, e.email, e.phone, e.subject,
                     e.order_reference) AS search_text,
                   'enquiry.manage' AS required_permission
              FROM contact_request e WHERE e.id = $1 AND e.deleted_at IS NULL`,
  delivery_zone: `SELECT z.name AS title,
                         CASE WHEN z.is_active THEN 'Active' ELSE 'Inactive' END AS context,
                         concat_ws(' ', z.name, z.lga) AS search_text,
                         'delivery.manage' AS required_permission
                    FROM delivery_zone z WHERE z.id = $1 AND z.deleted_at IS NULL`,
  setting: `SELECT replace(s.key, '_', ' ') AS title, 'Setting' AS context,
                   replace(s.key, '_', ' ') AS search_text,
                   'settings.view' AS required_permission
              FROM setting s WHERE s.key = $1`,
};

export async function removeAdminSearchDocument(
  tx: Queryable,
  entity: AdminSearchEntity,
  entityId: string,
): Promise<void> {
  await tx.query("DELETE FROM admin_search_document WHERE entity_type = $1 AND entity_id = $2", [
    entity,
    entityId,
  ]);
}

export async function syncAdminSearchDocument(
  tx: Queryable,
  entity: AdminSearchEntity,
  entityId: string,
): Promise<void> {
  const projected = await tx.query<SearchDocumentRow>(PROJECTOR_SQL[entity], [entityId]);
  const document = projected.rows[0];
  if (document === undefined) {
    await removeAdminSearchDocument(tx, entity, entityId);
    return;
  }

  await tx.query(
    `INSERT INTO admin_search_document
       (entity_type, entity_id, title, context, search_text, required_permission)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (entity_type, entity_id) DO UPDATE SET
       title = excluded.title,
       context = excluded.context,
       search_text = excluded.search_text,
       required_permission = excluded.required_permission,
       updated_at = now()`,
    [
      entity,
      entityId,
      document.title,
      document.context,
      document.search_text,
      document.required_permission,
    ],
  );
}

export async function syncAdminSearchDocuments(
  tx: Queryable,
  entity: AdminSearchEntity,
  entityIds: readonly string[],
): Promise<void> {
  for (const entityId of entityIds) {
    await syncAdminSearchDocument(tx, entity, entityId);
  }
}

export async function syncPaymentSearchDocumentsForOrder(
  tx: Queryable,
  orderId: string,
): Promise<void> {
  const payments = await tx.query<{ id: string }>("SELECT id FROM payment WHERE order_id = $1", [
    orderId,
  ]);
  await syncAdminSearchDocuments(
    tx,
    "payment",
    payments.rows.map((payment) => payment.id),
  );
}

export async function syncDeviceSearchDocumentsForBrand(
  tx: Queryable,
  brandId: string,
): Promise<void> {
  const devices = await tx.query<{ id: string }>("SELECT id FROM device WHERE brand_id = $1", [
    brandId,
  ]);
  await syncAdminSearchDocuments(
    tx,
    "device",
    devices.rows.map((device) => device.id),
  );
}

const SOURCE_IDS_SQL: Readonly<Record<AdminSearchEntity, string>> = {
  product: "SELECT id::STRING AS id FROM product",
  order: "SELECT id::STRING AS id FROM customer_order",
  customer: "SELECT id::STRING AS id FROM customer",
  payment: "SELECT id::STRING AS id FROM payment",
  brand: "SELECT id::STRING AS id FROM brand",
  category: "SELECT id::STRING AS id FROM category",
  device: "SELECT id::STRING AS id FROM device",
  staff: "SELECT id::STRING AS id FROM staff",
  review: "SELECT id::STRING AS id FROM review",
  enquiry: "SELECT id::STRING AS id FROM contact_request",
  delivery_zone: "SELECT id::STRING AS id FROM delivery_zone",
  setting: "SELECT key AS id FROM setting",
};

export type AdminSearchRebuildCounts = Readonly<Record<AdminSearchEntity, number>>;

/** Recreates every safe projection without exposing any source content to the caller. */
export async function rebuildAdminSearchIndex(): Promise<AdminSearchRebuildCounts> {
  return withTransaction(async (tx) => {
    await tx.query("DELETE FROM admin_search_document");
    const counts = {} as Record<AdminSearchEntity, number>;

    for (const entity of Object.keys(SOURCE_IDS_SQL) as AdminSearchEntity[]) {
      const sourceIds = await tx.query<{ id: string }>(SOURCE_IDS_SQL[entity]);
      await syncAdminSearchDocuments(
        tx,
        entity,
        sourceIds.rows.map((row) => row.id),
      );
      counts[entity] = sourceIds.rows.length;
    }

    return counts;
  });
}
