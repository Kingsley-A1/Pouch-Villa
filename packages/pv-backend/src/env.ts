import { existsSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Node's own dotenv loader, so this package needs no framework dependency to run
 * its scripts. Files are applied least-specific first; `process.loadEnvFile` does
 * not overwrite a variable that is already set, so a real environment variable
 * always wins over a file.
 */
const ENV_FILES = [".env", ".env.local"];

export function loadEnvFiles(root: string = process.cwd()) {
  const loaded: string[] = [];
  for (const name of ENV_FILES) {
    const path = resolve(root, name);
    if (!existsSync(path)) continue;
    process.loadEnvFile(path);
    loaded.push(name);
  }
  return loaded;
}
