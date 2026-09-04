import { resolve } from "node:path";
import { loadEnvFiles } from "../src/env";
import { query } from "../src/db/client";
import { listAllCategories, updateCategory } from "../src/services/categories";

/**
 * Files every category under one of the two the CEO asked for.
 *
 * The instruction was "there is only two product categories: Pouch and
 * Accessories", with luxury, protective and the rest becoming kinds inside them.
 * That is a change to the shop's own data, not to its code, and the admin can
 * already do it one category at a time — this exists because doing it by hand
 * across six categories on a live shop is where a step gets missed.
 *
 * **It goes through `updateCategory`, not through SQL.** Every move is audited
 * with an actor, a before and an after, exactly as it would be if a person had
 * made it in the admin. A script that wrote to the table directly would leave
 * the shop's structure changed with nothing in the trail to say who did it.
 *
 * Idempotent: a category already in the right place is left alone and reported
 * as such, so a second run is safe and says nothing happened.
 *
 * Nothing is deleted and no slug changes. Existing category URLs keep working —
 * only the parentage moves.
 *
 *   pnpm --filter @pv/backend restructure-categories
 *   pnpm --filter @pv/backend restructure-categories --apply
 */

/**
 * The two tops, and what belongs beneath each. Slugs rather than names, because
 * a slug is stable across a rename and a name is not.
 *
 * This is the client's instruction transcribed, not a default: it names their
 * six existing categories and would be wrong for any other shop. It lives in a
 * script they run once, not in the application — §4's rule is that the
 * catalogue's shape is theirs to change in the admin afterwards.
 */
const PLACEMENT: Record<string, readonly string[]> = {
  pouches: ["luxury-cases", "protective-cases"],
  accessories: ["power-bank", "chargers"],
};

async function main() {
  // The same pair every script here reads: the workspace root, then this
  // package, so a value set closer to the script wins.
  loadEnvFiles(resolve(process.cwd(), "../.."));
  loadEnvFiles(process.cwd());

  const apply = process.argv.includes("--apply");

  const actor = await query<{ id: string; full_name: string }>(
    `SELECT s.id, s.full_name FROM staff s
       JOIN role_permission g ON g.role_code = s.role_code AND g.permission_code = 'category.manage'
      WHERE s.deleted_at IS NULL AND s.status = 'active'
      ORDER BY s.created_at
      LIMIT 1`,
  );
  const staff = actor[0];
  if (staff === undefined) {
    console.error("No active staff member may manage categories, so there is nobody to attribute");
    console.error("these changes to. Claim a CEO account first.");
    process.exit(1);
  }

  const categories = await listAllCategories();
  const bySlug = new Map(categories.map((category) => [category.slug, category]));

  const moves: { child: string; parent: string; from: string | null }[] = [];

  for (const [parentSlug, childSlugs] of Object.entries(PLACEMENT)) {
    const parent = bySlug.get(parentSlug);
    if (parent === undefined) {
      console.log(`skip   ${parentSlug} — no such category`);
      continue;
    }
    if (parent.parentId !== null) {
      // A top must be a top. Left to the operator rather than corrected
      // silently, because it means the shop is not shaped the way this expects.
      console.log(`WARN   ${parentSlug} is itself filed under something else`);
    }
    for (const childSlug of childSlugs) {
      const child = bySlug.get(childSlug);
      if (child === undefined) {
        console.log(`skip   ${childSlug} — no such category`);
        continue;
      }
      if (child.parentId === parent.id) {
        console.log(`ok     ${childSlug} is already under ${parentSlug}`);
        continue;
      }
      moves.push({ child: childSlug, parent: parentSlug, from: child.parentId });
    }
  }

  if (moves.length === 0) {
    console.log("\nNothing to move.");
    process.exit(0);
  }

  console.log("");
  for (const move of moves) {
    console.log(`move   ${move.child} → under ${move.parent}`);
  }

  if (!apply) {
    console.log("\nThis was a dry run. Re-run with --apply to make these changes.");
    process.exit(0);
  }

  for (const move of moves) {
    const child = bySlug.get(move.child);
    const parent = bySlug.get(move.parent);
    // Both were present a moment ago when `moves` was built; this narrows the
    // lookup for the compiler rather than guarding against a real case.
    if (child === undefined || parent === undefined) continue;
    await updateCategory(
      child.id,
      {
        parentId: parent.id,
        // Everything except the parent is carried over untouched. This script
        // moves categories; it does not rename or re-describe them.
        name: child.name,
        description: child.description,
        sortOrder: child.sortOrder,
      },
      { staffId: staff.id },
    );
    console.log(`done   ${move.child} is now under ${move.parent}`);
  }

  console.log(`\n${moves.length} moved, attributed to ${staff.full_name}.`);
  process.exit(0);
}

void main();
