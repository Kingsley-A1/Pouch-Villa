import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { closePool, query } from "../src/db/client";
import { writableTestDatabaseConfigured } from "./helpers/database";
import {
  listBrandsInCategory,
  listDevicesInCategoryForBrand,
  listTopCategoryCards,
} from "../src/services/catalogue";
import {
  createHeroSlide,
  listAllHeroSlides,
  listHeroSlides,
  moveHeroSlide,
  setHeroSlideActive,
} from "../src/services/hero-slides";

const describeDb = writableTestDatabaseConfigured() ? describe : describe.skip;

/**
 * The CEO's browse path, against a real CockroachDB.
 *
 * These exist because the queries behind that path — the `catalogue_media`
 * joins, the recursive category subtree, the three-way device filter — are the
 * kind of thing a type checker cannot judge and a unit test cannot reach. The
 * first version of this work shipped with the joins written and no integration
 * suite touching them, so a green build proved only that the SQL parsed in
 * TypeScript, not that it ran.
 *
 * Everything is prefixed `zz-` and torn down in `afterAll`, so a run leaves the
 * test database as it found it.
 */

const created = {
  products: [] as string[],
  devices: [] as string[],
  slides: [] as string[],
  categories: [] as string[],
  brands: [] as string[],
};

let staffId: string;
let parentSlug: string;
let parentId: string;
let childId: string;
let brandId: string;
let brandSlug: string;

async function publishProduct(name: string, categoryId: string, brand: string | null) {
  const rows = await query<{ id: string }>(
    `INSERT INTO product (slug, name, brand_id, status, published_at)
          VALUES ($1, $2, $3, 'published', now()) RETURNING id`,
    [`zz-browse-${randomUUID()}`, name, brand],
  );
  const id = rows[0]!.id;
  created.products.push(id);
  await query("INSERT INTO product_category (product_id, category_id) VALUES ($1, $2)", [
    id,
    categoryId,
  ]);
  return id;
}

describeDb("the browse path and catalogue imagery", () => {
  beforeAll(async () => {
    const staff = await query<{ id: string }>(
      `INSERT INTO staff (email, full_name, role_code, status)
            VALUES ($1, 'ZZ Browse Test', 'CEO', 'active') RETURNING id`,
      [`zz-browse-${randomUUID()}@example.test`],
    );
    staffId = staff[0]!.id;

    parentSlug = `zz-pouches-${randomUUID()}`;
    const parent = await query<{ id: string }>(
      "INSERT INTO category (name, slug) VALUES ($1, $2) RETURNING id",
      ["ZZ Pouches", parentSlug],
    );
    parentId = parent[0]!.id;
    created.categories.push(parentId);

    // A child, so the recursive subtree in the card and brand queries is
    // actually exercised rather than only compiled.
    const child = await query<{ id: string }>(
      "INSERT INTO category (name, slug, parent_id) VALUES ($1, $2, $3) RETURNING id",
      ["ZZ Luxury", `zz-luxury-${randomUUID()}`, parentId],
    );
    childId = child[0]!.id;
    created.categories.push(childId);

    brandSlug = `zz-apple-${randomUUID()}`;
    const brand = await query<{ id: string }>(
      "INSERT INTO brand (name, slug) VALUES ($1, $2) RETURNING id",
      ["ZZ Apple", brandSlug],
    );
    brandId = brand[0]!.id;
    created.brands.push(brandId);
  }, 180_000);

  afterAll(async () => {
    const drop = async (sql: string, ids: string[]) => {
      if (ids.length > 0) await query(sql, [ids]);
    };
    await drop("DELETE FROM hero_slide WHERE id = ANY($1::UUID[])", created.slides);
    await drop("DELETE FROM product WHERE id = ANY($1::UUID[])", created.products);
    await drop("DELETE FROM device WHERE id = ANY($1::UUID[])", created.devices);
    // Children first: a parent still referenced by `parent_id` cannot go.
    await drop(
      "DELETE FROM catalogue_media WHERE category_id = ANY($1::UUID[])",
      created.categories,
    );
    await drop("DELETE FROM catalogue_media WHERE brand_id = ANY($1::UUID[])", created.brands);
    if (childId) await query("DELETE FROM category WHERE id = $1", [childId]);
    if (parentId) await query("DELETE FROM category WHERE id = $1", [parentId]);
    await drop("DELETE FROM brand WHERE id = ANY($1::UUID[])", created.brands);
    if (staffId) await query("DELETE FROM staff WHERE id = $1", [staffId]);
    await closePool();
  }, 180_000);

  it("counts a parent category from everything filed beneath it", async () => {
    // Filed on the child, counted on the parent. This is the recursive CTE, and
    // it is what makes a two-tier catalogue navigable at all.
    await publishProduct("ZZ Luxury Pouch", childId, brandId);

    const cards = await listTopCategoryCards();
    const mine = cards.find((card) => card.slug === parentSlug);
    expect(mine).toBeDefined();
    expect(mine?.productCount).toBe(1);
  });

  it("prefers the category's own photograph over a borrowed product image", async () => {
    const hash = randomUUID().replace(/-/g, "");
    await query(
      `INSERT INTO catalogue_media (category_id, r2_key, content_hash, width, height, uploaded_by)
            VALUES ($1, $2, $3, 1600, 1200, $4)`,
      [parentId, `categories/${parentId}/${hash}-card.webp`, hash, staffId],
    );

    const cards = await listTopCategoryCards();
    const mine = cards.find((card) => card.slug === parentSlug);

    // The point of the whole slice: a lifestyle photograph the CEO chose, not
    // whatever product happened to be published most recently.
    expect(mine?.image?.cardUrl).toContain(hash);
    // INT columns come back as strings from this driver; a number here proves
    // the coercion, and is what lets the tile reserve its box.
    expect(mine?.image?.width).toBe(1600);
    expect(typeof mine?.image?.width).toBe("number");
  });

  it("lists the brands inside a category, with a typed absence for a missing logo", async () => {
    const brands = await listBrandsInCategory(parentSlug);
    const mine = brands.find((brand) => brand.slug === brandSlug);

    expect(mine).toBeDefined();
    expect(mine?.productCount).toBe(1);
    // Absent, not an empty string or a broken URL — the card draws an initial.
    expect(mine?.logo).toBeNull();
  });

  it("returns the brand logo once one has been uploaded", async () => {
    const hash = randomUUID().replace(/-/g, "");
    await query(
      `INSERT INTO catalogue_media (brand_id, r2_key, content_hash, width, height, uploaded_by)
            VALUES ($1, $2, $3, 600, 400, $4)`,
      [brandId, `brands/${brandId}/${hash}-card.webp`, hash, staffId],
    );

    const brands = await listBrandsInCategory(parentSlug);
    const mine = brands.find((brand) => brand.slug === brandSlug);
    expect(mine?.logo?.url).toContain(hash);
    expect(mine?.logo?.height).toBe(400);
  });

  it("offers only the models this category actually stocks something for", async () => {
    const fitted = await query<{ id: string }>(
      "INSERT INTO device (brand_id, name, slug) VALUES ($1, $2, $3) RETURNING id",
      [brandId, "ZZ iPhone 15", `zz-15-${randomUUID()}`],
    );
    const fittedId = fitted[0]!.id;
    created.devices.push(fittedId);

    // A second model with no compatible product in this category. It must not
    // appear: a step that leads to an empty shelf is the one thing a guided
    // path must never do.
    const barren = await query<{ id: string }>(
      "INSERT INTO device (brand_id, name, slug) VALUES ($1, $2, $3) RETURNING id",
      [brandId, "ZZ iPhone 4", `zz-4-${randomUUID()}`],
    );
    created.devices.push(barren[0]!.id);

    const productId = created.products[0]!;
    await query("INSERT INTO product_compatibility (product_id, device_id) VALUES ($1, $2)", [
      productId,
      fittedId,
    ]);

    const models = await listDevicesInCategoryForBrand(parentSlug, brandSlug);
    expect(models.map((model) => model.name)).toEqual(["ZZ iPhone 15"]);
    expect(models[0]?.productCount).toBe(1);
  });

  it("keeps a hero slide out of the storefront until it has a photograph", async () => {
    const id = await createHeroSlide(
      { kicker: null, headline: "ZZ Headline", href: "/shop", ctaLabel: null, sortOrder: 900 },
      { staffId },
    );
    created.slides.push(id);

    // The admin sees it; the shop does not. §0 rule 2 applied to the largest
    // element on the page.
    expect((await listAllHeroSlides()).some((slide) => slide.id === id)).toBe(true);
    expect((await listHeroSlides()).some((slide) => slide.id === id)).toBe(false);
  });

  it("shows a slide once it has a photograph, and hides it again when switched off", async () => {
    const id = created.slides[0]!;
    const hash = randomUUID().replace(/-/g, "");
    await query(
      `UPDATE hero_slide
          SET image_r2_key = $2, image_hash = $3, image_width = 1600, image_height = 900
        WHERE id = $1`,
      [id, `hero/${id}/${hash}-hero.webp`, hash],
    );

    const shown = await listHeroSlides();
    const mine = shown.find((slide) => slide.id === id);
    expect(mine?.image.url).toContain(hash);
    expect(mine?.image.width).toBe(1600);

    await setHeroSlideActive(id, false, { staffId });
    expect((await listHeroSlides()).some((slide) => slide.id === id)).toBe(false);
  });

  it("swaps two slides rather than renumbering the whole list", async () => {
    const second = await createHeroSlide(
      { kicker: null, headline: "ZZ Second", href: "/shop", ctaLabel: null, sortOrder: 901 },
      { staffId },
    );
    created.slides.push(second);

    const before = (await listAllHeroSlides()).filter((slide) => created.slides.includes(slide.id));
    const [first] = before;
    expect(first?.headline).toBe("ZZ Headline");

    await moveHeroSlide(second, "up", { staffId });

    const after = (await listAllHeroSlides()).filter((slide) => created.slides.includes(slide.id));
    expect(after[0]?.headline).toBe("ZZ Second");
    // Swapped, not renumbered: the two positions are exactly the two that existed.
    expect(after.map((slide) => slide.sortOrder).sort()).toEqual([900, 901]);
  });
});
