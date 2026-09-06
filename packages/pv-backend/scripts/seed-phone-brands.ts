import { resolve } from "node:path";
import { loadEnvFiles } from "../src/env";
import { closePool, query } from "../src/db/client";
import { createBrand, listAllBrands } from "../src/services/brands";

/**
 * Puts the phone makers Pouch Villa sells for into the `brand` table.
 *
 * These are the second step of the CEO's browse path — Pouches, then which
 * phone, then which model — so the shop cannot offer that path for a make that
 * does not exist as a row.
 *
 * **Idempotent, and deliberately conservative.** It only ever inserts a name
 * that is not already there. It never renames, never re-slugs, never reactivates
 * a brand somebody deactivated, and never touches a soft-deleted one. Running it
 * twice does nothing the second time, and running it against a shop that has
 * been curated by hand does not undo that curation:
 *
 *   - A slug is already a URL somebody may have bookmarked, so an existing
 *     brand is left exactly as it is even if its name differs in case.
 *   - A deleted brand stays deleted. Resurrecting one silently would put a row
 *     back into the shopper's navigation that a staff member chose to remove.
 *
 * Names are matched case-insensitively so a second "iphone" cannot appear beside
 * "iPhone" and split the same maker's products across two brands.
 *
 * The write goes through `createBrand` rather than an INSERT here, so the slug is
 * derived by the same code the admin uses, the audit record is written, and the
 * admin search index is updated. Section 0 rule 6: every mutation is audited,
 * including one made from a script.
 *
 * Usage: pnpm --filter @pv/backend seed-brands
 */

const PHONE_BRANDS = ["iPhone", "Samsung", "Redmi", "Oppo", "Tecno", "Infinix", "Itel"] as const;

/**
 * The script needs an actor for the audit trail. It uses the CEO, because that
 * is who is accountable for the catalogue's shape — and if there is no CEO yet
 * there is no shop to seed, so it stops rather than writing an unattributed row.
 */
async function actingStaffId(): Promise<string> {
  const rows = await query<{ id: string }>(
    `SELECT id FROM staff
      WHERE role_code = 'CEO' AND status = 'active' AND deleted_at IS NULL
      ORDER BY created_at
      LIMIT 1`,
  );
  const ceo = rows[0];
  if (ceo === undefined) {
    throw new Error(
      "No active CEO account. Create one first with: pnpm --filter @pv/backend claim-code --role CEO",
    );
  }
  return ceo.id;
}

async function main() {
  loadEnvFiles(resolve(process.cwd(), "../.."));
  loadEnvFiles(process.cwd());

  const staffId = await actingStaffId();

  // Includes inactive rows but not deleted ones, which is exactly the set that
  // would collide on the unique slug index.
  const existing = await listAllBrands();
  const taken = new Set(existing.map((brand) => brand.name.trim().toLowerCase()));

  // A soft-deleted brand still holds its slug in the partial unique index only
  // while it is not deleted — but its *name* returning would be confusing, so it
  // is reported rather than silently duplicated.
  const deleted = await query<{ name: string }>(
    "SELECT name FROM brand WHERE deleted_at IS NOT NULL",
  );
  const removed = new Set(deleted.map((row) => row.name.trim().toLowerCase()));

  // Appended after whatever is already there, so seeding never reshuffles an
  // order a staff member has arranged.
  let sortOrder = existing.reduce((highest, brand) => Math.max(highest, brand.sortOrder), 0);

  const added: string[] = [];
  const skipped: string[] = [];

  for (const name of PHONE_BRANDS) {
    const key = name.trim().toLowerCase();
    if (taken.has(key)) {
      skipped.push(`${name} — already present`);
      continue;
    }
    if (removed.has(key)) {
      skipped.push(`${name} — exists but was removed; restore it in the admin if that was wrong`);
      continue;
    }
    sortOrder += 1;
    await createBrand({ name, sortOrder }, { staffId });
    added.push(name);
  }

  for (const line of skipped) console.log(`skipped  ${line}`);
  for (const name of added) console.log(`added    ${name}`);
  console.log(
    `\n${added.length} brand(s) added, ${skipped.length} left untouched. ` +
      `${existing.length + added.length} brand(s) now in the catalogue.`,
  );
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(closePool);
