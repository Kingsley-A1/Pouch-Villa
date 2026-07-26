import { loadEnvConfig } from "@next/env";

async function main() {
  loadEnvConfig(process.cwd());
  const { getDatabase } = await import("../src/lib/db");
  const db = getDatabase();
  const productCount = db.prepare("SELECT COUNT(*) AS count FROM products").get() as { count: number };
  console.log(`Pouch Hub demonstration database ready with ${productCount.count} products.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
