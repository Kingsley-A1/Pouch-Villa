import { spawn } from "node:child_process";
import { once } from "node:events";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

// The workspace keeps one .env at the repository root; load it so this script sees
// the same configuration the server it boots will see.
for (const name of [".env", ".env.local"]) {
  const path = resolve(import.meta.dirname, "../../..", name);
  if (existsSync(path)) process.loadEnvFile(path);
}

/**
 * Boots the production build and checks every public route answers and renders the
 * shell. This catches what a typecheck cannot: a route that compiles but throws at
 * request time — a missing environment variable, a bad query, a deleted component
 * still referenced by a layout.
 *
 * Routes that read the database are only checked when DATABASE_URL is set, so the
 * suite still means something in CI without a database rather than failing there.
 */

const port = 4187;
const origin = `http://127.0.0.1:${port}`;

const staticRoutes = ["/privacy", "/terms"];
const databaseRoutes = ["/", "/shop", "/categories", "/search"];

const routes = process.env.DATABASE_URL?.trim()
  ? [...databaseRoutes, ...staticRoutes]
  : staticRoutes;

const server = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", String(port)],
  { cwd: process.cwd(), env: process.env, stdio: ["ignore", "pipe", "pipe"] },
);

let serverOutput = "";
server.stdout.on("data", (chunk) => (serverOutput += chunk.toString()));
server.stderr.on("data", (chunk) => (serverOutput += chunk.toString()));

async function waitForServer() {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const response = await fetch(origin, { redirect: "manual" });
      if (response.status > 0) return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }
  throw new Error(`Production server did not become ready.\n${serverOutput}`);
}

let failure;
try {
  await waitForServer();
  const results = [];
  for (const route of routes) {
    const response = await fetch(`${origin}${route}`, { redirect: "manual" });
    if (response.status < 200 || response.status >= 400) {
      throw new Error(`${route} returned HTTP ${response.status}\n${serverOutput}`);
    }
    const body = await response.text();
    if (!body.includes("Pouch Villa")) {
      throw new Error(`${route} did not render the Pouch Villa shell`);
    }
    results.push(`${response.status} ${route}`);
  }
  console.log(results.join("\n"));
  if (routes === staticRoutes) {
    console.log("(database-backed routes skipped: DATABASE_URL is not set)");
  }
} catch (error) {
  failure = error;
} finally {
  // Waiting for the child to actually exit avoids a libuv assertion on Windows,
  // where the process was torn down while its stdio handles were still closing.
  server.kill("SIGTERM");
  await Promise.race([once(server, "exit"), new Promise((r) => setTimeout(r, 5000))]);
}

if (failure) {
  console.error(failure.message);
  process.exit(1);
}
