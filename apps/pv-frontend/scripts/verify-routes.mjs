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
  let nonced = 0;
  for (const route of routes) {
    const response = await fetch(`${origin}${route}`, { redirect: "manual" });
    if (response.status < 200 || response.status >= 400) {
      throw new Error(`${route} returned HTTP ${response.status}\n${serverOutput}`);
    }
    const body = await response.text();
    if (!body.includes("Pouch Villa")) {
      throw new Error(`${route} did not render the Pouch Villa shell`);
    }

    /*
      Every script on every page must carry the nonce. One that does not is a
      script the browser refuses to run, and the page breaks in production while
      a typecheck, a build and every other check here still pass.

      Checked on each route rather than only the home page: a hand-written
      <script> tends to be added to one page, and the point of the gate is to
      catch it wherever it lands.
    */
    const unnonced = [...body.matchAll(/<script\b([^>]*)>/g)]
      .map((match) => match[1])
      .filter((attrs) => !attrs.includes("nonce="));
    if (unnonced.length > 0) {
      throw new Error(
        `${unnonced.length} script tag(s) on ${route} carry no nonce and would be blocked by the ` +
          `Content-Security-Policy. If it is one of ours, read x-nonce from headers().`,
      );
    }
    nonced += body.match(/<script\b/g)?.length ?? 0;

    results.push(`${response.status} ${route}`);
  }

  /*
    The security headers, asserted against a running server rather than a unit
    test, because what matters is that the proxy actually runs on a document
    request and that Next honours the nonce it was given. A policy that is
    correct in a string builder and absent from the response protects nothing.
  */
  {
    const response = await fetch(`${origin}/`, { redirect: "manual" });
    const csp = response.headers.get("content-security-policy") ?? "";
    if (csp === "") throw new Error("/ served no Content-Security-Policy header");
    if (csp.includes("'unsafe-inline'")) {
      throw new Error("Content-Security-Policy allows 'unsafe-inline'; AGENTS.md §5 forbids it");
    }
    if (!/script-src[^;]*'nonce-/.test(csp)) {
      throw new Error("Content-Security-Policy does not carry a script nonce");
    }
    for (const header of ["x-content-type-options", "referrer-policy", "x-frame-options"]) {
      if (!response.headers.has(header)) throw new Error(`/ served no ${header} header`);
    }

    // The per-script nonce check runs in the route loop above, on every page
    // rather than only this one. This block asserts the header itself.
    results.push(`CSP ok on every route, ${nonced} script tags, all nonced`);
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
