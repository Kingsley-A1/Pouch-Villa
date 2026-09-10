import { resolve } from "node:path";
import { loadEnvFiles } from "../src/env";
import { closePool, query } from "../src/db/client";
import { createCategory, listAllCategories, updateCategory } from "../src/services/categories";

/**
 * Puts the accessory types Pouch Villa supplied under their Accessories section.
 *
 * Fifteen names typed by hand into a form is fifteen chances to fat-finger one,
 * and the client asked for something to start from rather than a blank screen.
 * They are recorded verbatim in `docs/client-inputs.md` §8; this puts them in the
 * database once.
 *
 * **This is a bootstrap command, not a rule in the source.** AGENTS.md §4 keeps
 * category lists out of code because a business fact must be changeable by a
 * non-engineer on a Sunday — and these still are: every one is editable,
 * reorderable and removable in Admin → Brands & Categories the moment it exists,
 * and nothing at runtime reads this file. `seed-phone-brands.ts` does the same
 * for the makes, for the same reason.
 *
 * **Idempotent, and deliberately conservative,** exactly as the brand seed is. It
 * only ever inserts a name that is not already under the parent. It never
 * renames, never re-slugs, never reorders what somebody has arranged, and never
 * resurrects a category that was removed — a row returning to the shopper's
 * navigation because a script ran twice is worse than a row that is missing.
 *
 * It also sets the parent section to "filed by type" if it is not already, since
 * a section full of types that still asks shoppers which phone they own is the
 * half-applied state this exists to avoid.
 *
 * Usage:
 *   pnpm --filter @pv/backend seed-accessory-types
 *   pnpm --filter @pv/backend seed-accessory-types -- --parent "Gadgets"
 */

/** Supplied by the client on 2026-09-10. Verbatim — see docs/client-inputs.md §8. */
const ACCESSORY_TYPES = [
  "Screen Protectors",
  "USB Cables (Type-C & Micro-USB)",
  "iPhone Cables (Lightning)",
  "Power Banks",
  "Phone Stands & Grips",
  "Fast-Charging Wall Adapters",
  "Wireless Charging Stations",
  "True Wireless Earbuds",
  "Bluetooth Speakers",
  "Smartwatches & Fitness Trackers",
  "Mobile Camera Lenses",
  "Content Creation Gear",
  "Wireless Mobile Microphones",
  "Mobile Gaming Accessories",
  "Bluetooth Smart Trackers",
] as const;

const DEFAULT_PARENT = "Accessories";

/** `--parent "Some Section"`, so a renamed section does not need a code change. */
function parentNameFromArgv(): string {
  const at = process.argv.indexOf("--parent");
  const given = at < 0 ? undefined : process.argv[at + 1];
  return given === undefined || given.startsWith("--") ? DEFAULT_PARENT : given;
}

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
  const parentName = parentNameFromArgv();

  const categories = await listAllCategories();
  const parent = categories.find(
    (category) =>
      category.parentId === null && category.name.trim().toLowerCase() === parentName.toLowerCase(),
  );
  if (parent === undefined) {
    throw new Error(
      `No top-level category called "${parentName}". Create it in Admin → Brands & Categories, ` +
        `or name an existing one with --parent "Its Name".`,
    );
  }

  /*
    The section itself has to be the by-type kind, or the admin still asks for a
    make and a device list and the storefront still asks a shopper which phone
    they own — with fifteen types sitting under it that nobody can reach.
  */
  if (parent.fitsDevices) {
    await updateCategory(
      parent.id,
      {
        parentId: parent.parentId,
        name: parent.name,
        description: parent.description,
        sortOrder: parent.sortOrder,
        fitsDevices: false,
      },
      { staffId },
    );
    console.log(`updated  ${parent.name} — now filed and browsed by type`);
  }

  const siblings = categories.filter((category) => category.parentId === parent.id);
  const taken = new Set(siblings.map((category) => category.name.trim().toLowerCase()));

  // A removed category keeps its name out of the way rather than reappearing.
  const deleted = await query<{ name: string }>(
    "SELECT name FROM category WHERE parent_id = $1 AND deleted_at IS NOT NULL",
    [parent.id],
  );
  const removed = new Set(deleted.map((row) => row.name.trim().toLowerCase()));

  // Appended after whatever is already there, so this never reshuffles an order
  // a staff member has arranged.
  let sortOrder = siblings.reduce((highest, category) => Math.max(highest, category.sortOrder), 0);

  const added: string[] = [];
  const skipped: string[] = [];

  for (const name of ACCESSORY_TYPES) {
    const key = name.trim().toLowerCase();
    if (taken.has(key)) {
      skipped.push(`${name} — already there`);
      continue;
    }
    if (removed.has(key)) {
      skipped.push(`${name} — exists but was removed; restore it in the admin if that was wrong`);
      continue;
    }
    sortOrder += 1;
    await createCategory(
      {
        parentId: parent.id,
        name,
        // §0 rule 2: no invented blurb. The CEO writes one if they want one.
        description: null,
        sortOrder,
        // Carried for completeness; a child inherits its section's answer.
        fitsDevices: false,
      },
      { staffId },
    );
    added.push(name);
  }

  for (const line of skipped) console.log(`skipped  ${line}`);
  for (const name of added) console.log(`added    ${name}`);
  console.log(
    `\n${added.length} type(s) added under ${parent.name}, ${skipped.length} left untouched. ` +
      `${siblings.length + added.length} type(s) now in that section.`,
  );
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(closePool);
