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

const staticRoutes = ["/track"];
const databaseRoutes = [
  "/",
  "/shop",
  "/categories",
  "/search",
  "/cart",
  "/contact",
  "/about",
  "/returns",
  "/privacy",
  "/terms",
  "/account/sign-in",
  "/account/register",
  "/account/forgot-password",
];

/**
 * The customer account is the only gated part of the storefront, and it must
 * send a signed-out visitor to the customer sign-in page — never to the staff
 * one. The two identity stacks share no session and no code path (AGENTS.md §5),
 * and a redirect that crossed them would be the first visible sign that they had
 * started to merge.
 */
const protectedAccountRoutes = [
  "/account",
  "/account/orders",
  "/account/saved",
  "/account/details",
  // The post-sign-up welcome. It is reached only with a session in hand, so a
  // signed-out request must be turned away like any other account route —
  // otherwise it becomes a page that congratulates a stranger on an account
  // that does not exist.
  "/account/welcome",
];

/**
 * Every protected admin route must send an unauthenticated visitor to the login
 * screen. This is the check the work plan claimed for months before it existed:
 * a route that renders admin data to a signed-out request is the failure the
 * whole session layer is there to prevent, and it is exactly the kind of thing a
 * typecheck cannot see.
 */
const protectedAdminRoutes = [
  "/admin",
  "/admin/products",
  "/admin/storefront",
  "/admin/categories",
  "/admin/devices",
  "/admin/delivery",
  "/admin/orders",
  "/admin/payments",
  "/admin/customers",
  "/admin/reviews",
  "/admin/contact",
  "/admin/staff",
  "/admin/roles",
  "/admin/settings",
];

/**
 * The API answers JSON, not the HTML shell, so these are checked separately.
 * `/api/v1/cart` with no cookie is the honest empty cart rather than an error —
 * a visitor who has never added anything is not a failure case.
 */
const apiRoutes = [
  { path: "/api/v1/cart", method: "GET", expect: 200 },
  // A checkout with no Idempotency-Key header must be refused, not quietly
  // accepted: that header is what stops a retried order being placed twice.
  { path: "/api/v1/checkout", method: "POST", expect: 422 },
];

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

  for (const route of protectedAdminRoutes) {
    const response = await fetch(`${origin}${route}`, { redirect: "manual" });
    // Next answers a redirecting Server Component with 307.
    if (response.status !== 307 && response.status !== 302) {
      throw new Error(
        `${route} returned HTTP ${response.status}; a signed-out request must be redirected to /admin/login`,
      );
    }
    const location = response.headers.get("location") ?? "";
    if (!location.includes("/admin/login")) {
      throw new Error(`${route} redirected to ${location} rather than /admin/login`);
    }
    results.push(`${response.status} ${route} -> /admin/login`);
  }

  if (process.env.DATABASE_URL?.trim()) {
    for (const route of protectedAccountRoutes) {
      const response = await fetch(`${origin}${route}`, { redirect: "manual" });
      if (response.status !== 307 && response.status !== 302) {
        throw new Error(
          `${route} returned HTTP ${response.status}; a signed-out request must be redirected to the customer sign-in`,
        );
      }
      const location = response.headers.get("location") ?? "";
      if (!location.includes("/account/sign-in")) {
        throw new Error(`${route} redirected to ${location} rather than /account/sign-in`);
      }
      if (location.includes("/admin")) {
        throw new Error(`${route} redirected a customer into the staff login at ${location}`);
      }
      results.push(`${response.status} ${route} -> /account/sign-in`);
    }

    for (const route of apiRoutes) {
      const response = await fetch(`${origin}${route.path}`, {
        method: route.method,
        redirect: "manual",
        ...(route.method === "POST"
          ? { headers: { "Content-Type": "application/json" }, body: "{}" }
          : {}),
      });
      if (response.status !== route.expect) {
        throw new Error(
          `${route.method} ${route.path} returned HTTP ${response.status}, expected ${route.expect}\n${serverOutput}`,
        );
      }
      const body = await response.json();
      if (typeof body?.ok !== "boolean") {
        throw new Error(`${route.method} ${route.path} did not answer the { ok } envelope`);
      }
      results.push(`${response.status} ${route.method} ${route.path}`);
    }
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
