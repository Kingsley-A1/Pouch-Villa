import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { closePool, query } from "../src/db/client";
import { writableTestDatabaseConfigured } from "./helpers/database";
import {
  InvalidProductCursorError,
  listFittingCategoriesByDevice,
  listPublishedProducts,
} from "../src/services/catalogue";
import { encodeProductCursor } from "../src/domain/product-cursor";

const describeDb = writableTestDatabaseConfigured() ? describe : describe.skip;

/**
 * "View all products" has to mean all of them.
 *
 * The shop used to read one page of 24 and discard the cursor, so a catalogue of
 * any size silently ended at an arbitrary row. These walk a real list, page by
 * page, against CockroachDB — the keyset comparison on a timestamp and a UUID is
 * exactly the kind of SQL a type checker cannot judge.
 *
 * Everything is prefixed `zz-` and removed in `afterAll`.
 */

const created = {
  products: [] as string[],
  categories: [] as string[],
  brands: [] as string[],
  devices: [] as string[],
};

let categorySlug: string;
let categoryId: string;
let sectionSlug: string;
let sectionId: string;
let typeSlug: string;
let typeId: string;

async function publish(name: string, publishedAtSql: string, categoryIds: string[]) {
  const rows = await query<{ id: string }>(
    `INSERT INTO product (slug, name, status, published_at)
          VALUES ($1, $2, 'published', ${publishedAtSql}) RETURNING id`,
    [`zz-paging-${randomUUID()}`, name],
  );
  const id = rows[0]!.id;
  created.products.push(id);
  for (const category of categoryIds) {
    await query("INSERT INTO product_category (product_id, category_id) VALUES ($1, $2)", [
      id,
      category,
    ]);
  }
  return id;
}

async function walk(limit: number, extra: Parameters<typeof listPublishedProducts>[0] = {}) {
  const seen: string[] = [];
  let cursor: string | undefined;
  for (let guard = 0; guard < 20; guard += 1) {
    const page = await listPublishedProducts({ ...extra, limit, ...(cursor ? { cursor } : {}) });
    seen.push(...page.products.map((product) => product.id));
    if (page.nextCursor === null) return seen;
    cursor = page.nextCursor;
  }
  throw new Error("The cursor never ran out");
}

describeDb("paging the published catalogue", () => {
  beforeAll(async () => {
    categorySlug = `zz-paging-${randomUUID()}`;
    const category = await query<{ id: string }>(
      "INSERT INTO category (name, slug) VALUES ($1, $2) RETURNING id",
      ["ZZ Paging", categorySlug],
    );
    categoryId = category[0]!.id;
    created.categories.push(categoryId);

    sectionSlug = `zz-fit-${randomUUID()}`;
    const section = await query<{ id: string }>(
      "INSERT INTO category (name, slug) VALUES ($1, $2) RETURNING id",
      ["ZZ Fit Section", sectionSlug],
    );
    sectionId = section[0]!.id;
    created.categories.push(sectionId);

    typeSlug = `zz-fit-type-${randomUUID()}`;
    const type = await query<{ id: string }>(
      "INSERT INTO category (name, slug, parent_id) VALUES ($1, $2, $3) RETURNING id",
      ["ZZ Fit Type", typeSlug, sectionId],
    );
    typeId = type[0]!.id;
    created.categories.push(typeId);

    // Five products, oldest first. Two share a timestamp on purpose: a keyset on
    // the timestamp alone would skip or repeat one of them at a page boundary.
    await publish("ZZ Pagingtoken one", "now() - interval '5 hours'", [categoryId]);
    await publish("ZZ Pagingtoken two", "now() - interval '4 hours'", [categoryId]);
    await publish("ZZ Pagingtoken three", "TIMESTAMPTZ '2030-01-01 00:00:00+00'", [categoryId]);
    await publish("ZZ Pagingtoken four", "TIMESTAMPTZ '2030-01-01 00:00:00+00'", [categoryId]);
    await publish("ZZ Pagingtoken five", "now() - interval '1 hour'", [categoryId]);
  }, 180_000);

  afterAll(async () => {
    const drop = async (sql: string, ids: string[]) => {
      if (ids.length > 0) await query(sql, [ids]);
    };
    await drop("DELETE FROM product WHERE id = ANY($1::UUID[])", created.products);
    await drop("DELETE FROM device WHERE id = ANY($1::UUID[])", created.devices);
    // The type before its section: a parent still referenced cannot go.
    if (typeId) await query("DELETE FROM category WHERE id = $1", [typeId]);
    if (sectionId) await query("DELETE FROM category WHERE id = $1", [sectionId]);
    if (categoryId) await query("DELETE FROM category WHERE id = $1", [categoryId]);
    await drop("DELETE FROM brand WHERE id = ANY($1::UUID[])", created.brands);
    await closePool();
  }, 180_000);

  it("reaches every product by following the cursor, once each", async () => {
    const seen = await walk(2, { categorySlug });
    expect(seen).toHaveLength(5);
    expect(new Set(seen).size).toBe(5);
    expect(new Set(seen)).toEqual(new Set(created.products));
  });

  it("is newest first, so the front of the shop is the latest stock", async () => {
    const seen = await walk(2, { categorySlug });
    // Two products share the newest timestamp, so they lead (in either order).
    expect(new Set(seen.slice(0, 2))).toEqual(new Set(created.products.slice(2, 4)));
    expect(seen[2]).toBe(created.products[4]);
    expect(seen[3]).toBe(created.products[1]);
    expect(seen[4]).toBe(created.products[0]);
  });

  it("counts every match, not just the page, and only when asked", async () => {
    const counted = await listPublishedProducts({ categorySlug, limit: 2, withTotal: true });
    expect(counted.products).toHaveLength(2);
    expect(counted.total).toBe(5);

    const second = await listPublishedProducts({
      categorySlug,
      limit: 2,
      withTotal: true,
      cursor: counted.nextCursor!,
    });
    // The total is how many in all, so it does not shrink as the shopper pages.
    expect(second.total).toBe(5);

    const uncounted = await listPublishedProducts({ categorySlug, limit: 2 });
    expect(uncounted.total).toBeNull();
  });

  it("ends with no cursor on the last page", async () => {
    const page = await listPublishedProducts({ categorySlug, limit: 5 });
    expect(page.products).toHaveLength(5);
    expect(page.nextCursor).toBeNull();
  });

  it("pages a search by relevance without repeating a product", async () => {
    const seen = await walk(2, { search: "pagingtoken" });
    const mine = seen.filter((id) => created.products.includes(id));
    expect(mine).toHaveLength(5);
    expect(new Set(seen).size).toBe(seen.length);
  });

  it("refuses a cursor it did not issue, and one from the other kind of list", async () => {
    await expect(listPublishedProducts({ cursor: "not-a-cursor" })).rejects.toBeInstanceOf(
      InvalidProductCursorError,
    );
    const searchCursor = encodeProductCursor({ kind: "search", offset: 2 });
    await expect(listPublishedProducts({ cursor: searchCursor })).rejects.toBeInstanceOf(
      InvalidProductCursorError,
    );
  });

  it("offers a device only the categories that hold something fitting it", async () => {
    const brand = await query<{ id: string }>(
      "INSERT INTO brand (name, slug) VALUES ($1, $2) RETURNING id",
      ["ZZ Phone Maker", `zz-maker-${randomUUID()}`],
    );
    created.brands.push(brand[0]!.id);

    const fittedSlug = `zz-fits-${randomUUID()}`;
    const fitted = await query<{ id: string }>(
      "INSERT INTO device (brand_id, name, slug) VALUES ($1, $2, $3) RETURNING id",
      [brand[0]!.id, "ZZ Fitted", fittedSlug],
    );
    const bareSlug = `zz-bare-${randomUUID()}`;
    const bare = await query<{ id: string }>(
      "INSERT INTO device (brand_id, name, slug) VALUES ($1, $2, $3) RETURNING id",
      [brand[0]!.id, "ZZ Bare", bareSlug],
    );
    created.devices.push(fitted[0]!.id, bare[0]!.id);

    // Filed under the section and one of its types, as the admin form does.
    const filedUnderType = await publish("ZZ Fit case", "now()", [sectionId, typeId]);
    await query("INSERT INTO product_compatibility (product_id, device_id) VALUES ($1, $2)", [
      filedUnderType,
      fitted[0]!.id,
    ]);
    // A product that fits no device, in the paging category: a power bank.
    // It must not be offered against any device.

    const map = await listFittingCategoriesByDevice();
    expect(new Set(map[fittedSlug])).toEqual(new Set([sectionSlug, typeSlug]));
    expect(map[fittedSlug]).not.toContain(categorySlug);
    expect(map[bareSlug]).toBeUndefined();
  });
});
