import { resolve } from "node:path";
import { loadEnvFiles } from "../src/env";
import { closePool } from "../src/db/client";
import { migrate } from "../src/db/migrate";

/**
 * Applies every pending migration, in order, exactly once.
 *
 * Run against a deployed environment before the release that needs the change.
 * CockroachDB applies schema changes online and asynchronously, so a successful
 * return means the statements were accepted, not that every range has caught up.
 */
async function main() {
  loadEnvFiles(resolve(process.cwd(), "../.."));
  loadEnvFiles(process.cwd());

  const started = Date.now();
  const { applied, alreadyApplied } = await migrate();

  if (applied.length === 0) {
    console.log(`Nothing to apply. ${alreadyApplied} migration(s) already recorded.`);
  } else {
    for (const name of applied) console.log(`applied  ${name}`);
    console.log(`\n${applied.length} migration(s) applied in ${Date.now() - started}ms.`);
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(closePool);
