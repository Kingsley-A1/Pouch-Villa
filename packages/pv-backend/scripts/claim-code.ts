import { resolve } from "node:path";
import { loadEnvFiles } from "../src/env";
import { closePool, query } from "../src/db/client";
import { formatRoleCodeForDisplay, isStaffRole, type StaffRoleCode } from "../src/auth/role-codes";
import {
  BOOTSTRAP_CODE_TTL_MINUTES,
  DEFAULT_CODE_TTL_MINUTES,
  mintRoleCode,
} from "../src/services/staff-access";

/**
 * Mints a role code from the command line. This is the CEO bootstrap: with nothing
 * seeded, the first CEO account comes into existence by redeeming a code minted
 * here, by someone who already has access to the deployed environment.
 *
 * The plaintext is printed once and never stored. Losing it means minting another.
 */

function usage(): never {
  console.error(
    [
      "Usage: pnpm --filter @pv/backend claim-code --role <CEO|MANAGER|EMPLOYEE> [options]",
      "",
      "  --role <role>       Access level the code grants. Required.",
      "  --label <text>      A note for the admin list, e.g. who it was issued to.",
      "  --uses <n>          How many accounts it may create. Default 1.",
      "  --ttl <minutes>     Lifetime. Default 15 for CEO, 7 days otherwise.",
      "",
      "A CEO code cannot be minted while an active CEO already exists; ask them to",
      "invite you from the admin instead. Use --force only to recover a locked-out",
      "account, and expect the audit trail to show it.",
      "  --force             Mint a CEO code despite an existing active CEO.",
    ].join("\n"),
  );
  process.exit(1);
}

function flag(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

async function main() {
  loadEnvFiles(resolve(process.cwd(), "../.."));
  loadEnvFiles(process.cwd());

  const roleInput = flag("role")?.toUpperCase();
  if (roleInput === undefined || !isStaffRole(roleInput)) usage();
  const role: StaffRoleCode = roleInput;

  const uses = Number(flag("uses") ?? 1);
  if (!Number.isInteger(uses) || uses < 1) usage();

  const ttl = Number(
    flag("ttl") ?? (role === "CEO" ? BOOTSTRAP_CODE_TTL_MINUTES : DEFAULT_CODE_TTL_MINUTES),
  );
  if (!Number.isFinite(ttl) || ttl <= 0) usage();

  if (role === "CEO" && !process.argv.includes("--force")) {
    const existing = await query<{ total: number }>(
      "SELECT count(*)::INT AS total FROM staff WHERE role_code = 'CEO' AND status = 'active' AND deleted_at IS NULL",
    );
    if ((existing[0]?.total ?? 0) > 0) {
      console.error(
        "An active CEO already exists. Have them invite you from the admin, or pass --force to override.",
      );
      process.exit(1);
    }
  }

  const label = flag("label");
  const minted = await mintRoleCode(
    { role, maxUses: uses, ttlMinutes: ttl, ...(label === undefined ? {} : { label }) },
    { staffId: null },
  );

  const pinned = process.env.BOOTSTRAP_CEO_EMAIL?.trim();
  const lines = [
    "",
    `  Code     ${formatRoleCodeForDisplay(minted.code)}`,
    `  Role     ${minted.role}`,
    `  Uses     ${uses}`,
    `  Expires  ${minted.expiresAt.toISOString()}  (${ttl} minutes)`,
  ];
  if (role === "CEO" && pinned) lines.push(`  Redeemer ${pinned}  (pinned by BOOTSTRAP_CEO_EMAIL)`);
  lines.push(
    "",
    "  Redeem at /admin/claim. This code is not stored and cannot be shown again.",
    "",
  );
  console.log(lines.join("\n"));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(closePool);
