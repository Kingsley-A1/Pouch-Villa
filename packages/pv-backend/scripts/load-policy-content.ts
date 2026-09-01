import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { loadEnvFiles } from "../src/env";
import { closePool, queryOne } from "../src/db/client";
import { writeSettings, type SettingKey } from "../src/services/settings";

/**
 * Loads the supporting-page content from `docs/decisions/` into the settings
 * store.
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
 * About and Return & Warranty are the client's own wording. Privacy and Terms
 * were drafted against the NDPA 2023 from an audit of what this repository
 * actually does, per Q10's instruction to use "the best information available".
 * They are marked pending legal review in the source document.
 */

const DOCS = resolve(import.meta.dirname, "../../../docs/decisions");

/**
 * Which document supplies which page, and under which `## ` heading.
 *
 * Privacy and Terms were drafted against the NDPA 2023 from an audit of what
 * this repository actually does — every processor, cookie and retention rule in
 * them was read out of the code. They carry a pending-legal-review banner in the
 * source document, which is deliberately *not* loaded into the page: the caveat
 * is for Pouch Villa, not for a shopper.
 */
const SOURCES: { key: SettingKey; file: string; heading: string }[] = [
  { key: "policy.about", file: "About-Policy.md", heading: "About Pouch Villa" },
  { key: "policy.returns", file: "About-Policy.md", heading: "Return & Warranty Policy" },
  { key: "policy.privacy", file: "Privacy-Terms.md", heading: "Privacy Policy" },
  { key: "policy.terms", file: "Privacy-Terms.md", heading: "Terms & Conditions" },
];

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
  const only = process.argv.includes("--only")
    ? process.argv[process.argv.indexOf("--only") + 1]
    : null;

  // Attributed to the CEO, who owns this content. There is no synthetic actor:
  // the audit trail should name a real person.
  const ceo = await queryOne<{ id: string; email: string }>(
    "SELECT id, email FROM staff WHERE role_code = 'CEO' AND deleted_at IS NULL ORDER BY created_at LIMIT 1",
  );
  if (ceo === null) {
    throw new Error("No CEO account exists yet. Claim one before loading page content.");
  }

  const cache = new Map<string, string>();
  const entries: Partial<Record<SettingKey, string>> = {};

  for (const source of SOURCES) {
    if (only !== null && source.key !== only) continue;

    let markdown = cache.get(source.file);
    if (markdown === undefined) {
      markdown = await readFile(resolve(DOCS, source.file), "utf8");
      cache.set(source.file, markdown);
    }

    const body = section(markdown, source.heading);
    if (body === null) {
      throw new Error(`Could not find "## ${source.heading}" in ${source.file}.`);
    }

    const existing = await queryOne<{ value: string | null }>(
      "SELECT value FROM setting WHERE key = $1",
      [source.key],
    );
    const alreadySet = existing !== null && existing.value !== null && existing.value !== "";

    if (alreadySet && !force) {
      console.log(`  skipped  ${source.key}  (already set; pass --force to overwrite)`);
      continue;
    }
    console.log(`  writing  ${source.key}  (${body.length} characters)`);
    entries[source.key] = body;
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
