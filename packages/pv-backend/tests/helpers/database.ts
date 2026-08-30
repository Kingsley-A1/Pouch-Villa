import { resolve } from "node:path";
import { loadEnvFiles } from "../../src/env";

/**
 * Guards which database a test may touch.
 *
 * Read-only suites can point at any environment. **Writing suites must not**, and
 * this is not a hypothetical: an early run of the staff-access tests left twenty-six
 * live, unexpired role codes in the production database — usable credentials, each
 * one enough to create a staff account.
 *
 * So a writing suite runs only against `TEST_DATABASE_URL`, which it also installs
 * as `DATABASE_URL` for the process. Leaving it unset skips those tests rather than
 * quietly falling back to whatever `DATABASE_URL` happens to hold.
 */

loadEnvFiles(resolve(process.cwd(), "../.."));
loadEnvFiles(process.cwd());

export function readOnlyDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

export function writableTestDatabaseConfigured(): boolean {
  const testUrl = process.env.TEST_DATABASE_URL?.trim();
  if (!testUrl) return false;
  if (testUrl === process.env.DATABASE_URL?.trim()) {
    throw new Error(
      "TEST_DATABASE_URL is the same as DATABASE_URL. Writing tests must target a separate database.",
    );
  }
  process.env.DATABASE_URL = testUrl;
  return true;
}
