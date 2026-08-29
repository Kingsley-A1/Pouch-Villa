import { spawn } from "node:child_process";

const port = 4187;
const origin = `http://127.0.0.1:${port}`;
const routes = [
  "/",
  "/find-my-case",
  "/shop",
  "/shop/apple/iphone-15-pro",
  "/collections",
  "/collections/new-arrivals",
  "/products/blush-arc",
  "/search",
  "/saved",
  "/request-case",
  "/reservation?product=blush-arc&device=iphone-15-pro",
  "/visit-us",
  "/help",
  "/privacy",
  "/terms",
  "/admin/login",
];

const server = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", String(port)],
  {
    cwd: process.cwd(),
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
  },
);

let serverOutput = "";
server.stdout.on("data", (chunk) => {
  serverOutput += chunk.toString();
});
server.stderr.on("data", (chunk) => {
  serverOutput += chunk.toString();
});

async function waitForServer() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(origin, { redirect: "manual" });
      if (response.status > 0) return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw new Error(`Production server did not become ready.\n${serverOutput}`);
}

try {
  await waitForServer();
  const results = [];
  for (const route of routes) {
    const response = await fetch(`${origin}${route}`, { redirect: "manual" });
    if (response.status < 200 || response.status >= 400) {
      throw new Error(`${route} returned HTTP ${response.status}`);
    }
    const body = await response.text();
    if (!body.includes("Pouch Villa"))
      throw new Error(`${route} did not render the Pouch Villa shell`);
    results.push(`${response.status} ${route}`);
  }

  const protectedResponse = await fetch(`${origin}/admin`, { redirect: "manual" });
  if (
    ![302, 303, 307, 308].includes(protectedResponse.status) ||
    !protectedResponse.headers.get("location")?.includes("/admin/login")
  ) {
    throw new Error("Unauthenticated /admin access was not redirected to the secure login page");
  }
  results.push(`${protectedResponse.status} /admin → protected login`);
  console.log(results.join("\n"));
} finally {
  server.kill("SIGTERM");
}
