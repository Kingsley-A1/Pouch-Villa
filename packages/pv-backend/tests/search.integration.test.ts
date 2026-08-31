import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { closePool, query } from "../src/db/client";
import { writableTestDatabaseConfigured } from "./helpers/database";
import { listPublishedProducts } from "../src/services/catalogue";

const describeDb = writableTestDatabaseConfigured() ? describe : describe.skip;

const created: string[] = [];

async function publishProduct(name: string, summary: string, description: string) {
  const slug = `zz-search-${randomUUID()}`;
  const rows = await query<{ id: string }>(
    `INSERT INTO product (slug, name, summary, description, status, published_at)
          VALUES ($1, $2, $3, $4, 'published', now())
       RETURNING id`,
    [slug, name, summary, description],
  );
  const id = rows[0]!.id;
  created.push(id);
  // A published product needs an active priced variant to look real to callers.
  await query(`INSERT INTO product_variant (product_id, sku, price_kobo) VALUES ($1, $2, $3)`, [
    id,
    `ZZ-${randomUUID().slice(0, 8).toUpperCase()}`,
    500000,
  ]);
  return id;
}

describeDb("catalogue search", () => {
  beforeAll(async () => {
    await publishProduct(
      "OtterBox Defender Case",
      "Rugged protection for everyday knocks",
      "A heavy duty polycarbonate shell with a silicone inner layer.",
    );
    await publishProduct(
      "Blue Silicone Pouch",
      "Soft-touch everyday pouch",
      "A slim blue pouch in soft silicone, sized for a standard handset.",
    );
    await publishProduct(
      "Anker Fast Charger",
      "20W USB-C wall charger",
      "Charges a phone quickly from any standard socket.",
    );
  }, 120_000);

  afterAll(async () => {
    if (created.length > 0) {
      await query("DELETE FROM product_variant WHERE product_id = ANY($1)", [created]);
      await query("DELETE FROM product WHERE id = ANY($1)", [created]);
    }
    await closePool();
  });

  it("finds a product by a word in its name", async () => {
    const { products } = await listPublishedProducts({ search: "otterbox" });
    expect(products.map((product) => product.name)).toContain("OtterBox Defender Case");
  });

  it("finds a product by a word only in its description", async () => {
    const { products } = await listPublishedProducts({ search: "polycarbonate" });
    expect(products.map((product) => product.name)).toContain("OtterBox Defender Case");
  });

  it("stems, so a plural finds the singular", async () => {
    const { products } = await listPublishedProducts({ search: "chargers" });
    expect(products.map((product) => product.name)).toContain("Anker Fast Charger");
  });

  it("tolerates a misspelling", async () => {
    // This is the Phase 2 gate's own acceptance line: search returns sensible
    // results for a misspelling. Trigram similarity, not full text, does this.
    const { products } = await listPublishedProducts({ search: "otterbocks" });
    expect(products.map((product) => product.name)).toContain("OtterBox Defender Case");
  });

  it("ranks the better match first", async () => {
    const { products } = await listPublishedProducts({ search: "silicone" });
    // "Blue Silicone Pouch" has it in the name; the OtterBox only in its body.
    expect(products[0]?.name).toBe("Blue Silicone Pouch");
  });

  it("does not match an unrelated term", async () => {
    const { products } = await listPublishedProducts({ search: "refrigerator" });
    expect(products.filter((product) => created.includes(product.id))).toHaveLength(0);
  });

  it("no longer matches a substring the way LIKE did", async () => {
    // "harge" is a substring of "Charger" — LIKE '%harge%' matched it, which is
    // how the prototype returned wrong results for partial words and SKUs.
    const { products } = await listPublishedProducts({ search: "harge" });
    expect(products.map((product) => product.name)).not.toContain("Anker Fast Charger");
  });
});
