import { isPermissionCode, type PermissionCode } from "../auth/permission-codes";
import { query } from "../db/client";

export const ADMIN_SEARCH_ENTITIES = [
  "product",
  "order",
  "customer",
  "payment",
  "brand",
  "category",
  "device",
  "staff",
  "review",
  "enquiry",
  "delivery_zone",
  "setting",
] as const;

export type AdminSearchEntity = (typeof ADMIN_SEARCH_ENTITIES)[number];

export type AdminSearchResult = {
  entity: AdminSearchEntity;
  entityId: string;
  title: string;
  context: string | null;
  requiredPermission: PermissionCode;
};

export type AdminSearchInput = { query: string; limit?: number };

export type NormalizedAdminSearchInput = { query: string; limit: number };

const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 20;

export function normalizeAdminSearchInput(
  input: AdminSearchInput,
): NormalizedAdminSearchInput | null {
  const query = input.query.trim().replace(/\s+/g, " ");
  if (query.length < 2) return null;

  const requested = Math.floor(input.limit ?? DEFAULT_LIMIT);
  return { query, limit: Math.max(1, Math.min(MAX_LIMIT, requested)) };
}

function isAdminSearchEntity(value: string): value is AdminSearchEntity {
  return (ADMIN_SEARCH_ENTITIES as readonly string[]).includes(value);
}

export async function searchAdmin(
  actorStaffId: string,
  input: AdminSearchInput,
): Promise<AdminSearchResult[]> {
  const normalized = normalizeAdminSearchInput(input);
  if (normalized === null) return [];

  const rows = await query<{
    entity_type: string;
    entity_id: string;
    title: string;
    context: string | null;
    required_permission: string;
  }>(
    `WITH actor_permissions AS (
       SELECT rp.permission_code
         FROM staff s
         JOIN role_permission rp ON rp.role_code = s.role_code
        WHERE s.id = $1
          AND s.status = 'active'
          AND s.deleted_at IS NULL
     )
     SELECT d.entity_type, d.entity_id, d.title, d.context, d.required_permission
       FROM admin_search_document d
       JOIN actor_permissions ap ON ap.permission_code = d.required_permission
      WHERE d.search_vector @@ plainto_tsquery('simple', $2)
         OR similarity(d.title, $2) >= 0.2
      ORDER BY (ts_rank(d.search_vector, plainto_tsquery('simple', $2))
                + similarity(d.title, $2)) DESC,
               d.title,
               d.entity_id
      LIMIT $3`,
    [actorStaffId, normalized.query, normalized.limit],
  );

  return rows.flatMap((row) => {
    if (!isAdminSearchEntity(row.entity_type) || !isPermissionCode(row.required_permission)) {
      return [];
    }
    return [
      {
        entity: row.entity_type,
        entityId: row.entity_id,
        title: row.title,
        context: row.context,
        requiredPermission: row.required_permission,
      },
    ];
  });
}
