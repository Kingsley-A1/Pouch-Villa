import { resolve } from "node:path";
import { loadEnvFiles } from "../src/env";
import { closePool, query, queryOne } from "../src/db/client";
import { createCategory } from "../src/services/categories";
import { createHomeSection } from "../src/services/home-sections";
import { createDeliveryZone } from "../src/services/delivery";
import { kobo } from "../src/domain/money";
import type { HomeSectionLayout } from "../src/domain/section-layout";

/**
 * Puts the storefront's opening arrangement in place: two categories, a home
 * section for each, and the delivery areas the shop serves.
 *
 * ## This is client-specified structure, not seed data
 *
 * AGENTS.md §0 rule 2 forbids invented data, and that rule is why this script is
 * shaped the way it is. Everything here is a name the client asked for — the
 * category names, the section headings, the areas. None of it is a placeholder
 * standing in for an answer nobody has given.
 *
 * Where an answer genuinely is missing, this script **refuses to guess**:
 *
 *   - **Delivery fees are not seeded.** [`open-questions.md`](../../../docs/open-questions.md)
 *     Q8 asks the client what each area costs and how long it takes, and that is
 *     unanswered. A made-up fee here would reach a real customer at checkout as
 *     a real price. So every area is created at a zero fee and **inactive**,
 *     which keeps it out of `listActiveDeliveryZones` and therefore out of
 *     checkout entirely. The CEO sets the real fee and activates it, and the
 *     admin screen is where that happens.
 *   - **No products.** Only the CEO knows what is actually in stock.
 *
 * ## Idempotent, and safe against production
 *
 * Every insert checks for an existing row by name first, so re-running changes
 * nothing. That matters because the useful thing to do with this script is run
 * it against the real database — unlike a fixture file, there is nothing here
 * that would be embarrassing in front of a customer.
 *
 * Attributed to the CEO account, like every other privileged mutation. There is
 * no synthetic actor: an audit trail that says "system" for a decision a person
 * made is a worse record than no shortcut at all.
 *
 * Run with: pnpm --filter @pv/backend seed-storefront
 */

/** The two lines the client named, and the heading each carries on the home page. */
const SECTIONS: {
  category: { name: string; description: string };
  section: { title: string; subtitle: string; layout: HomeSectionLayout; maxItems: number };
}[] = [
  {
    category: {
      name: "Luxury Cases",
      description: "Leather, metal and premium finishes, for a phone that is worth dressing well.",
    },
    section: {
      title: "Luxury Cases",
      subtitle: "Considered materials and finishes, for a phone worth dressing well.",
      // A small, considered range reads better with one piece leading it.
      layout: "feature",
      maxItems: 7,
    },
  },
  {
    category: {
      name: "Protective Cases",
      description: "Drop-tested shells, rugged armour and reinforced corners for daily wear.",
    },
    section: {
      title: "Protective Cases",
      subtitle: "Rugged shells and reinforced corners, built to survive a real day out.",
      // A broad utilitarian range, and the tint breaks up a long white page.
      layout: "band",
      maxItems: 8,
    },
  },
];

/**
 * The areas the shop delivers to.
 *
 * Cross River State local government areas, plus a catch-all for everywhere
 * else. A place name is not a business fact of the kind §4 forbids — it is not
 * a claim about Pouch Villa, and it does not go stale. **What each one costs
 * is** a business fact, and it is deliberately absent: see the header.
 */
const AREAS = [
  "Calabar Municipal",
  "Calabar South",
  "Akamkpa",
  "Odukpani",
  "Akpabuyo",
  "Bakassi",
  "Biase",
  "Yakurr",
  "Abi",
  "Obubra",
  "Etung",
  "Ikom",
  "Boki",
  "Ogoja",
  "Yala",
  "Bekwarra",
  "Obudu",
  "Obanliku",
  "Outside Cross River",
];

async function main() {
  // Both roots, and inside `main` rather than at module scope: an ESM import is
  // evaluated before the module body, so loading at the top would run after the
  // database client had already been imported.
  loadEnvFiles(resolve(process.cwd(), "../.."));
  loadEnvFiles(process.cwd());

  const ceo = await queryOne<{ id: string; email: string }>(
    "SELECT id, email FROM staff WHERE role_code = 'CEO' AND deleted_at IS NULL ORDER BY created_at LIMIT 1",
  );
  if (ceo === null) {
    throw new Error("No CEO account exists yet. Claim one before seeding the storefront.");
  }
  const actor = { staffId: ceo.id };
  console.log(`Attributing to the CEO account (${ceo.email}).\n`);

  let categoriesCreated = 0;
  let sectionsCreated = 0;

  for (const [index, entry] of SECTIONS.entries()) {
    const existingCategory = await queryOne<{ id: string }>(
      "SELECT id FROM category WHERE name = $1 AND deleted_at IS NULL",
      [entry.category.name],
    );

    let categoryId: string;
    if (existingCategory === null) {
      categoryId = await createCategory(
        {
          parentId: null,
          name: entry.category.name,
          description: entry.category.description,
          sortOrder: index,
        },
        actor,
      );
      categoriesCreated += 1;
      console.log(`  category  created   ${entry.category.name}`);
    } else {
      categoryId = existingCategory.id;
      console.log(`  category  exists    ${entry.category.name}`);
    }

    const existingSection = await queryOne<{ id: string }>(
      "SELECT id FROM home_section WHERE category_id = $1 AND deleted_at IS NULL",
      [categoryId],
    );
    if (existingSection === null) {
      await createHomeSection(
        {
          kind: "category",
          layout: entry.section.layout,
          title: entry.section.title,
          subtitle: entry.section.subtitle,
          categoryId,
          brandId: null,
          maxItems: entry.section.maxItems,
          sortOrder: index,
        },
        actor,
      );
      sectionsCreated += 1;
      console.log(`  section   created   ${entry.section.title} (${entry.section.layout})`);
    } else {
      console.log(`  section   exists    ${entry.section.title}`);
    }
  }

  const existingAreas = await query<{ lga: string }>(
    "SELECT DISTINCT lga FROM delivery_zone WHERE lga IS NOT NULL AND deleted_at IS NULL",
  );
  const known = new Set(existingAreas.map((row) => row.lga));

  let areasCreated = 0;
  for (const area of AREAS) {
    if (known.has(area)) continue;
    const zoneId = await createDeliveryZone(
      {
        name: area,
        lga: area,
        // Zero, and inactive below, because Q8 is unanswered. An invented fee
        // here would be quoted to a real customer as a real price.
        feeKobo: kobo(0),
        minDays: null,
        maxDays: null,
      },
      actor,
    );
    // Created active by default; taken out of checkout until it has a real fee.
    await query("UPDATE delivery_zone SET is_active = false WHERE id = $1", [zoneId]);
    areasCreated += 1;
  }

  console.log(`\n  areas     created   ${areasCreated} (inactive, awaiting a fee)`);
  console.log(
    [
      "",
      `Categories created: ${categoriesCreated}. Sections created: ${sectionsCreated}.`,
      `Delivery areas created: ${areasCreated}.`,
      "",
      "Next, in the admin:",
      "  1. Delivery — set each area's fee and timeframe, then activate it.",
      "     Nothing is offered at checkout until you do; that is deliberate.",
      "  2. Products — file products under Luxury Cases or Protective Cases.",
      "     A section with no published products is hidden rather than shown empty.",
    ].join("\n"),
  );
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(closePool);
