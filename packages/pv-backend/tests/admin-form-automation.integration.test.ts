import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closePool, query } from "../src/db/client";
import { migrate } from "../src/db/migrate";
import { kobo } from "../src/domain/money";
import { createDeliveryZone, getDeliveryZone, updateDeliveryZone } from "../src/services/delivery";
import { createVariant, getProductForEdit, updateVariant } from "../src/services/products";
import { writableTestDatabaseConfigured } from "./helpers/database";

const describeDb = writableTestDatabaseConfigured() ? describe : describe.skip;
const staffId = randomUUID();
const productId = randomUUID();
const deliveryIds: string[] = [];
const variantIds: string[] = [];

describeDb("admin form automation", () => {
  beforeAll(async () => {
    await migrate();
    await query(
      `INSERT INTO staff (id, email, full_name, role_code, status)
       VALUES ($1, $2, 'Form Automation Staff', 'CEO', 'active')`,
      [staffId, `form-${staffId}@example.test`],
    );
    await query(
      `INSERT INTO product (id, slug, name, status)
       VALUES ($1, $2, 'iPhone 15 Pro Case', 'draft')`,
      [productId, `form-${productId}`],
    );
  }, 120_000);

  afterAll(async () => {
    await query("DELETE FROM audit_log WHERE actor_id = $1 OR entity_id = ANY($2::UUID[])", [
      staffId,
      [...deliveryIds, ...variantIds],
    ]).catch(() => {});
    await query("DELETE FROM admin_search_document WHERE entity_id = ANY($1::UUID[])", [
      [...deliveryIds, productId],
    ]).catch(() => {});
    await query("DELETE FROM variant_value WHERE variant_id = ANY($1::UUID[])", [variantIds]).catch(
      () => {},
    );
    await query("DELETE FROM product_variant WHERE product_id = $1", [productId]).catch(() => {});
    await query("DELETE FROM delivery_zone WHERE id = ANY($1::UUID[])", [deliveryIds]).catch(
      () => {},
    );
    await query("DELETE FROM product WHERE id = $1", [productId]).catch(() => {});
    await query("DELETE FROM staff WHERE id = $1", [staffId]).catch(() => {});
    await closePool();
  });

  it("decodes delivery money and assigns consecutive order while edits preserve it", async () => {
    for (const name of ["Automation One", "Automation Two"]) {
      deliveryIds.push(
        await createDeliveryZone(
          {
            name,
            lga: "Outside Calabar",
            feeKobo: kobo(250000),
            minDays: 1,
            maxDays: 3,
          },
          { staffId },
        ),
      );
    }

    const first = await getDeliveryZone(deliveryIds[0] ?? "");
    const second = await getDeliveryZone(deliveryIds[1] ?? "");
    expect(first?.feeKobo).toBe(250000);
    expect(second?.sortOrder).toBe((first?.sortOrder ?? -1) + 1);

    await updateDeliveryZone(
      deliveryIds[0] ?? "",
      {
        name: "Automation Edited",
        lga: "Calabar South",
        feeKobo: kobo(300000),
        minDays: 2,
        maxDays: 4,
      },
      { staffId },
    );
    expect((await getDeliveryZone(deliveryIds[0] ?? ""))?.sortOrder).toBe(first?.sortOrder);
  });

  it("generates unique readable SKUs and preserves them through an edit", async () => {
    for (const price of [150000, 175000]) {
      const id = await createVariant(
        productId,
        { priceKobo: kobo(price), compareAtKobo: null, axes: {} },
        { staffId },
      );
      expect(id).not.toBeNull();
      if (id !== null) variantIds.push(id);
    }

    const created = await getProductForEdit(productId);
    expect(created?.variants.map((variant) => variant.sku)).toEqual([
      expect.stringMatching(/^IPHONE-15-PRO-CASE-[A-Z0-9]{4}$/),
      expect.stringMatching(/^IPHONE-15-PRO-CASE-[A-Z0-9]{4}$/),
    ]);
    expect(new Set(created?.variants.map((variant) => variant.sku)).size).toBe(2);

    const first = created?.variants[0];
    expect(first).toBeDefined();
    if (first === undefined) return;
    await updateVariant(
      first.id,
      { priceKobo: kobo(200000), compareAtKobo: null, axes: { colour: "Black" } },
      { staffId },
    );
    const edited = (await getProductForEdit(productId))?.variants.find(
      (variant) => variant.id === first.id,
    );
    expect(edited?.sku).toBe(first.sku);
    expect(edited?.sortOrder).toBe(first.sortOrder);
    expect(edited?.priceKobo).toBe(200000);
  });
});
