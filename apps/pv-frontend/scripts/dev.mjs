import { spawn } from "node:child_process";
import { resolve } from "node:path";

const incoming = process.argv.slice(2);
const args = [];
for (let index = 0; index < incoming.length; index += 1) {
  const value = incoming[index];
  if (value === "--strictPort") continue;
  if (value === "--host") {
    args.push("--hostname");
    continue;
  }
  args.push(value);
}

const child = spawn(
  process.execPath,
  [resolve("node_modules/next/dist/bin/next"), "dev", ...args],
  { stdio: "inherit", env: process.env },
);
child.on("exit", (code) => process.exit(code ?? 1));
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
