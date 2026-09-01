import { resolve } from "node:path";
import { closePool } from "../src/db/client";
import { loadEnvFiles } from "../src/env";
import { rebuildAdminSearchIndex } from "../src/services/admin-search-index";

async function main() {
  loadEnvFiles(resolve(process.cwd(), "../.."));
  loadEnvFiles(process.cwd());

  const counts = await rebuildAdminSearchIndex();
  for (const [entity, count] of Object.entries(counts)) {
    console.log(`${entity}: ${count}`);
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(closePool);
