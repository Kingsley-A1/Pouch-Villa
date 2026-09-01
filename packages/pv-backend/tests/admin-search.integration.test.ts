import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closePool, query } from "../src/db/client";
import { migrate } from "../src/db/migrate";
import { searchAdmin } from "../src/services/admin-search";
import { writableTestDatabaseConfigured } from "./helpers/database";

const describeDb = writableTestDatabaseConfigured() ? describe : describe.skip;

const staffId = randomUUID();
const documentId = randomUUID();

describeDb("admin search permissions", () => {
  beforeAll(async () => {
    await migrate();
    await query(
      `INSERT INTO staff (id, email, full_name, role_code, status)
       VALUES ($1, $2, $3, 'CEO', 'active')`,
      [staffId, `search-${staffId}@example.test`, "Search Test Staff"],
    );
    await query(
      `INSERT INTO admin_search_document
         (entity_type, entity_id, title, context, search_text, required_permission)
       VALUES ('product', $1, 'Signal Test Product', 'Draft product',
               'Signal Test Product signal-token', 'product.view')`,
      [documentId],
    );
  }, 120_000);

  afterAll(async () => {
    await query(
      "DELETE FROM admin_search_document WHERE entity_type = 'product' AND entity_id = $1",
      [documentId],
    ).catch(() => {});
    await query("DELETE FROM staff WHERE id = $1", [staffId]).catch(() => {});
    await closePool();
  });

  it("returns an authorised route-neutral result", async () => {
    await expect(searchAdmin(staffId, { query: "signal-token" })).resolves.toEqual([
      {
        entity: "product",
        entityId: documentId,
        title: "Signal Test Product",
        context: "Draft product",
        requiredPermission: "product.view",
      },
    ]);
  });

  it("returns no results after the actor is suspended", async () => {
    await query("UPDATE staff SET status = 'suspended' WHERE id = $1", [staffId]);
    await expect(searchAdmin(staffId, { query: "signal-token" })).resolves.toEqual([]);
  });
});
