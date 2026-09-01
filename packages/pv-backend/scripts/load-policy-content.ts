import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { loadEnvFiles } from "../src/env";
import { closePool, queryOne } from "../src/db/client";
import { writeSettings, type SettingKey } from "../src/services/settings";

/**
 * Loads client-supplied page content from `docs/decisions/About-Policy.md` into
 * the settings store.
 *
 * **Why a script rather than a constant in a component.** AGENTS.md §4 forbids
 * policy or legal wording in source, and that rule earns its keep here: wording
 * compiled into a page can only be corrected by a deployment, which is not
 * something the shop owner can do on a Sunday when they spot a mistake in their
 * own returns terms. The wording therefore lives in the settings store, where
 * the admin UI can edit it. `docs/` is exempt from the hardcoded-fact check, so
 * the signed-off source document stays readable in the repository as evidence.
 *
 * **This is not seed data.** It is real, client-supplied content being loaded
 * into the store that owns it, so it is safe to run against production — which
 * is the whole point. It is idempotent, and once a person edits a value in the
 * admin, re-running this would overwrite them, so it is explicitly opt-in per
 * key via --force.
 *
 * Covers About and Return & Warranty only. Q10 remains open for Privacy and
 * Terms, and those pages keep their awaiting-confirmation notice rather than
 * carrying wording nobody signed off.
 */

const SOURCE = resolve(import.meta.dirname, "../../../docs/decisions/About-Policy.md");

/** Pulls one `## ` section out of the document, minus its own heading. */
function section(markdown: string, heading: string): string | null {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const start = lines.findIndex((line) => line.trim() === `## ${heading}`);
  if (start === -1) return null;

  const body: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (line.startsWith("## ")) break;
    // The document's `---` rules separate sections; they are not content.
    if (line.trim() === "---") continue;
    body.push(line);
  }
  return body.join("\n").trim() || null;
}

async function main() {
  loadEnvFiles(resolve(process.cwd(), "../.."));
  loadEnvFiles(process.cwd());

  const force = process.argv.includes("--force");
  const markdown = await readFile(SOURCE, "utf8");

  const about = section(markdown, "About Pouch Villa");
  const returns = section(markdown, "Return & Warranty Policy");

  if (about === null || returns === null) {
    throw new Error(
      "Could not find the 'About Pouch Villa' and 'Return & Warranty Policy' sections in the source document.",
    );
  }

  // Attributed to the CEO, who owns this content. There is no synthetic actor:
  // the audit trail should name a real person.
  const ceo = await queryOne<{ id: string; email: string }>(
    "SELECT id, email FROM staff WHERE role_code = 'CEO' AND deleted_at IS NULL ORDER BY created_at LIMIT 1",
  );
  if (ceo === null) {
    throw new Error("No CEO account exists yet. Claim one before loading page content.");
  }

  const entries: Partial<Record<SettingKey, string>> = {
    "policy.about": about,
    "policy.returns": returns,
  };

  for (const [key, value] of Object.entries(entries) as [SettingKey, string][]) {
    const existing = await queryOne<{ value: string | null; origin: string }>(
      "SELECT value, origin FROM setting WHERE key = $1",
      [key],
    );
    const alreadySet = existing !== null && existing.value !== null && existing.value !== "";

    if (alreadySet && !force) {
      console.log(`  skipped  ${key}  (already set; pass --force to overwrite)`);
      delete entries[key];
      continue;
    }
    console.log(`  writing  ${key}  (${value.length} characters)`);
  }

  if (Object.keys(entries).length === 0) {
    console.log("\nNothing to do.\n");
    return;
  }

  await writeSettings(entries, { staffId: ceo.id });
  console.log(`\nLoaded ${Object.keys(entries).length} page(s), attributed to the CEO account.`);
  console.log("Edit them any time at /admin/settings.\n");
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(closePool);
