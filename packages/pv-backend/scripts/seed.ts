import { loadEnvFiles } from "../src/env";

async function main() {
  loadEnvFiles();
  const { getDatabase } = await import("../src/db/index");
  const db = getDatabase();
  const productCount = db.prepare("SELECT COUNT(*) AS count FROM products").get() as {
    count: number;
  };
  console.log(`Pouch Villa demonstration database ready with ${productCount.count} products.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
