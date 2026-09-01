import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closePool, query } from "../src/db/client";
import { migrate } from "../src/db/migrate";
import { withTransaction } from "../src/db/transaction";
import { searchAdmin } from "../src/services/admin-search";
import { syncAdminSearchDocument } from "../src/services/admin-search-index";
import { writableTestDatabaseConfigured } from "./helpers/database";

const describeDb = writableTestDatabaseConfigured() ? describe : describe.skip;

const staffId = randomUUID();
const productId = randomUUID();

describeDb("admin search document synchronization", () => {
  beforeAll(async () => {
    await migrate();
    await query(
      `INSERT INTO staff (id, email, full_name, role_code, status)
       VALUES ($1, $2, $3, 'CEO', 'active')`,
      [staffId, `sync-${staffId}@example.test`, "Sync Test Staff"],
    );
    await query(
      `INSERT INTO product (id, slug, name, status)
       VALUES ($1, $2, 'Quartz Search Sleeve', 'draft')`,
      [productId, `quartz-${productId}`],
    );
    await query(
      `INSERT INTO product_variant (product_id, sku, price_kobo)
       VALUES ($1, 'QZ-SYNC-7788', 10000)`,
      [productId],
    );
  }, 120_000);

  afterAll(async () => {
    await query("DELETE FROM admin_search_document WHERE entity_id IN ($1, $2)", [
      productId,
      staffId,
    ]).catch(() => {});
    await query("DELETE FROM product_variant WHERE product_id = $1", [productId]).catch(() => {});
    await query("DELETE FROM product WHERE id = $1", [productId]).catch(() => {});
    await query("DELETE FROM staff WHERE id = $1", [staffId]).catch(() => {});
    await closePool();
  });

  it("projects searchable product identity and removes a soft-deleted product", async () => {
    await withTransaction((tx) => syncAdminSearchDocument(tx, "product", productId));

    const indexed = await searchAdmin(staffId, { query: "QZ-SYNC-7788" });
    expect(indexed.map((result) => result.entityId)).toContain(productId);

    await query("UPDATE product SET deleted_at = now() WHERE id = $1", [productId]);
    await withTransaction((tx) => syncAdminSearchDocument(tx, "product", productId));

    const removed = await searchAdmin(staffId, { query: "QZ-SYNC-7788" });
    expect(removed.map((result) => result.entityId)).not.toContain(productId);
  });
});
