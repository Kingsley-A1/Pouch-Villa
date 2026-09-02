import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { closePool, query } from "../src/db/client";
import { writableTestDatabaseConfigured } from "./helpers/database";
import {
  countLikes,
  generateVisitorToken,
  hasLiked,
  likeCountsFor,
  listLikedProducts,
  mergeVisitorLikes,
  toggleLike,
} from "../src/services/likes";
import {
  createHomeSection,
  InvalidSectionSourceError,
  listCollectionIdsForProduct,
  listHomeSections,
  setProductCollections,
} from "../src/services/home-sections";

const describeDb = writableTestDatabaseConfigured() ? describe : describe.skip;

const products: string[] = [];
const sections: string[] = [];
const customers: string[] = [];
let staffId: string;
let categoryId: string;
let categorySlug: string;

async function publishProduct(name: string) {
  const slug = `zz-store-${randomUUID()}`;
  const rows = await query<{ id: string }>(
    `INSERT INTO product (slug, name, status, published_at)
          VALUES ($1, $2, 'published', now()) RETURNING id`,
    [slug, name],
  );
  const id = rows[0]!.id;
  products.push(id);
  await query("INSERT INTO product_variant (product_id, sku, price_kobo) VALUES ($1, $2, $3)", [
    id,
    `ZZ-${randomUUID().slice(0, 8).toUpperCase()}`,
    500000,
  ]);
  return id;
}

async function makeCustomer() {
  const rows = await query<{ id: string }>(
    "INSERT INTO customer (email) VALUES ($1) RETURNING id",
    [`zz-store-${randomUUID()}@example.test`],
  );
  const id = rows[0]!.id;
  customers.push(id);
  return id;
}

describeDb("storefront likes and home sections", () => {
  beforeAll(async () => {
    const staff = await query<{ id: string }>(
      `INSERT INTO staff (email, full_name, role_code, status)
            VALUES ($1, 'ZZ Storefront Test', 'CEO', 'active') RETURNING id`,
      [`zz-store-${randomUUID()}@example.test`],
    );
    staffId = staff[0]!.id;

    categorySlug = `zz-cat-${randomUUID()}`;
    const category = await query<{ id: string }>(
      "INSERT INTO category (name, slug) VALUES ($1, $2) RETURNING id",
      ["ZZ Test Pouches", categorySlug],
    );
    categoryId = category[0]!.id;
  }, 180_000);

  afterAll(async () => {
    if (sections.length > 0) {
      await query("DELETE FROM home_section WHERE id = ANY($1::UUID[])", [sections]);
    }
    if (products.length > 0) {
      await query("DELETE FROM product WHERE id = ANY($1::UUID[])", [products]);
    }
    if (customers.length > 0) {
      await query("DELETE FROM customer WHERE id = ANY($1::UUID[])", [customers]);
    }
    if (categoryId) await query("DELETE FROM category WHERE id = $1", [categoryId]);
    if (staffId) await query("DELETE FROM staff WHERE id = $1", [staffId]);
    await closePool();
  }, 180_000);

  it("counts a like once however many times the button is tapped", async () => {
    const productId = await publishProduct("ZZ Likeable Pouch");
    const customerId = await makeCustomer();

    const first = await toggleLike(productId, { customerId });
    expect(first).toEqual({ liked: true, count: 1 });

    // The unique index, not a read-then-write, is what makes this safe.
    const second = await toggleLike(productId, { customerId });
    expect(second).toEqual({ liked: false, count: 0 });

    const third = await toggleLike(productId, { customerId });
    expect(third).toEqual({ liked: true, count: 1 });
    expect(await hasLiked(productId, { customerId })).toBe(true);
  }, 120_000);

  it("keeps a signed-out visitor's like separate from a customer's", async () => {
    const productId = await publishProduct("ZZ Two Actor Pouch");
    const customerId = await makeCustomer();
    const visitorToken = generateVisitorToken();

    await toggleLike(productId, { customerId });
    const both = await toggleLike(productId, { visitorToken });

    expect(both.count).toBe(2);
    expect(await hasLiked(productId, { visitorToken })).toBe(true);
  }, 120_000);

  it("carries a visitor's likes into the account they sign in to", async () => {
    const productId = await publishProduct("ZZ Merge Pouch");
    const visitorToken = generateVisitorToken();
    const customerId = await makeCustomer();

    await toggleLike(productId, { visitorToken });
    await mergeVisitorLikes(visitorToken, customerId);

    // One row, now owned by the customer: the count must not double.
    expect(await countLikes(productId)).toBe(1);
    expect(await hasLiked(productId, { customerId })).toBe(true);
    expect(await hasLiked(productId, { visitorToken })).toBe(false);

    const saved = await listLikedProducts(customerId);
    expect(saved.map((product) => product.id)).toContain(productId);
  }, 120_000);

  it("does not double a like the visitor and the account both made", async () => {
    const productId = await publishProduct("ZZ Overlap Pouch");
    const visitorToken = generateVisitorToken();
    const customerId = await makeCustomer();

    await toggleLike(productId, { visitorToken });
    await toggleLike(productId, { customerId });
    expect(await countLikes(productId)).toBe(2);

    await mergeVisitorLikes(visitorToken, customerId);
    expect(await countLikes(productId)).toBe(1);
  }, 120_000);

  it("will not like a product that is not published", async () => {
    const rows = await query<{ id: string }>(
      "INSERT INTO product (slug, name, status) VALUES ($1, $2, 'draft') RETURNING id",
      [`zz-draft-${randomUUID()}`, "ZZ Draft Pouch"],
    );
    const productId = rows[0]!.id;
    products.push(productId);

    const result = await toggleLike(productId, { customerId: await makeCustomer() });
    expect(result).toEqual({ liked: false, count: 0 });
  }, 120_000);

  it("returns counts for a whole grid in one query", async () => {
    const liked = await publishProduct("ZZ Counted Pouch");
    const unliked = await publishProduct("ZZ Uncounted Pouch");
    await toggleLike(liked, { customerId: await makeCustomer() });

    const counts = await likeCountsFor([liked, unliked]);
    expect(counts.get(liked)).toBe(1);
    // Absent rather than zero, which is what lets the card hide the count.
    expect(counts.has(unliked)).toBe(false);
  }, 120_000);

  it("refuses a category section with no category chosen", async () => {
    await expect(
      createHomeSection(
        {
          kind: "category",
          title: "ZZ Broken",
          subtitle: null,
          categoryId: null,
          brandId: null,
          maxItems: 8,
          sortOrder: 0,
        },
        { staffId },
      ),
    ).rejects.toBeInstanceOf(InvalidSectionSourceError);
  }, 120_000);

  it("fills a category section from the catalogue and hides it when empty", async () => {
    const sectionId = await createHomeSection(
      {
        kind: "category",
        title: "ZZ Pouches On Show",
        subtitle: "Tested",
        categoryId,
        brandId: null,
        maxItems: 8,
        sortOrder: 900,
      },
      { staffId },
    );
    sections.push(sectionId);

    // Nothing is filed in the category yet, so the section must not render.
    const before = await listHomeSections();
    expect(before.find((section) => section.id === sectionId)).toBeUndefined();

    const productId = await publishProduct("ZZ Categorised Pouch");
    await query("INSERT INTO product_category (product_id, category_id) VALUES ($1, $2)", [
      productId,
      categoryId,
    ]);

    const after = await listHomeSections();
    const section = after.find((entry) => entry.id === sectionId);
    expect(section?.products.map((product) => product.id)).toEqual([productId]);
    expect(section?.browseHref).toBe(`/shop?category=${categorySlug}`);
  }, 180_000);

  it("shows a hand-picked collection in the order it was picked", async () => {
    const sectionId = await createHomeSection(
      {
        kind: "collection",
        title: "ZZ Staff Picks",
        subtitle: null,
        categoryId: null,
        brandId: null,
        maxItems: 8,
        sortOrder: 901,
      },
      { staffId },
    );
    sections.push(sectionId);

    const first = await publishProduct("ZZ Picked One");
    const second = await publishProduct("ZZ Picked Two");
    await setProductCollections(second, [sectionId], { staffId });
    await setProductCollections(first, [sectionId], { staffId });

    expect(await listCollectionIdsForProduct(first)).toEqual([sectionId]);

    const section = (await listHomeSections()).find((entry) => entry.id === sectionId);
    expect(section?.products).toHaveLength(2);
    expect(section?.browseHref).toBeNull();

    // Unpublishing a member drops it from the section rather than breaking it.
    await query("UPDATE product SET status = 'unpublished' WHERE id = $1", [first]);
    const reduced = (await listHomeSections()).find((entry) => entry.id === sectionId);
    expect(reduced?.products.map((product) => product.id)).toEqual([second]);
  }, 180_000);

  it("removes a product from a collection when it is unticked", async () => {
    const sectionId = await createHomeSection(
      {
        kind: "collection",
        title: "ZZ Removable",
        subtitle: null,
        categoryId: null,
        brandId: null,
        maxItems: 8,
        sortOrder: 902,
      },
      { staffId },
    );
    sections.push(sectionId);

    const productId = await publishProduct("ZZ Removable Pouch");
    await setProductCollections(productId, [sectionId], { staffId });
    expect(await listCollectionIdsForProduct(productId)).toEqual([sectionId]);

    await setProductCollections(productId, [], { staffId });
    expect(await listCollectionIdsForProduct(productId)).toEqual([]);
  }, 180_000);
});
