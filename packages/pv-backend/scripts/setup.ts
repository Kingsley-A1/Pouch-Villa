import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

async function main() {
  const root = process.cwd();
  const envPath = resolve(root, ".env.local");
  const email = "admin@pouchvilla.demo";
  const password = `PH-${randomBytes(9).toString("base64url")}!`;
  const secret = randomBytes(32).toString("base64url");
  const createdEnvironment = !existsSync(envPath);

  if (createdEnvironment) {
    writeFileSync(
      envPath,
      [
        "DATABASE_URL=data/pouch-villa-prototype.db",
        `AUTH_SECRET=${secret}`,
        `DEMO_ADMIN_EMAIL=${email}`,
        `DEMO_ADMIN_PASSWORD=${password}`,
        "NEXT_PUBLIC_WHATSAPP_NUMBER=",
        "NEXT_PUBLIC_STORE_ADDRESS=",
        "NEXT_PUBLIC_STORE_HOURS=",
        "",
      ].join("\n"),
      { mode: 0o600 },
    );
    console.log("Created .env.local with a new prototype-only secret and administrator password.");
  } else {
    console.log("Existing .env.local preserved.");
  }

  mkdirSync(resolve(root, "data"), { recursive: true });
  const { loadEnvConfig } = await import("@next/env");
  loadEnvConfig(root, true);
  const { getDatabase } = await import("../src/db/index");
  const db = getDatabase();
  const count = db.prepare("SELECT COUNT(*) AS count FROM products").get() as { count: number };

  console.log(`Database ready with ${count.count} demonstration products.`);
  if (createdEnvironment) {
    console.log(`Demo admin email: ${email}`);
    console.log(`Demo admin password: ${password}`);
  } else {
    console.log("Demo credentials are stored in .env.local.");
  }
  console.log("Run npm run dev to start Pouch Villa.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
