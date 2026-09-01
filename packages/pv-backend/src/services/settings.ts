import { query, queryOne, type Queryable } from "../db/client";
import { withTransaction } from "../db/transaction";
import { recordAudit } from "./audit";
import { syncAdminSearchDocument } from "./admin-search-index";

/**
 * Settings hold every business fact, and there is exactly one source of truth: this
 * table.
 *
 * The environment participates as a **seed, not a competitor**. On first run an
 * environment variable populates a key that has no value yet, and the row is marked
 * `origin = 'environment'`. The moment a person edits it in the admin the row
 * becomes `origin = 'admin'` and the environment stops applying to it — for good,
 * including across restarts and redeploys.
 *
 * That is what keeps the two in synergy rather than in conflict. Without the origin
 * marker, a redeploy would silently overwrite what a staff member set on a Sunday,
 * and nobody would know which value was live.
 */

export type SettingOrigin = "unset" | "environment" | "admin";

export type SettingKey =
  | "bank.account_name"
  | "bank.account_number"
  | "bank.bank_name"
  | "store.address"
  | "store.opening_hours"
  | "store.whatsapp_number"
  | "store.contact_email"
  | "delivery.free_threshold_kobo"
  | "policy.about"
  | "policy.returns"
  | "policy.privacy"
  | "policy.terms";

/**
 * Which environment variable, if any, may seed each key. Infrastructure-shaped
 * bootstrapping only — the value still lives in the database once seeded.
 */
export const ENVIRONMENT_SEEDS: Partial<Record<SettingKey, string>> = {
  "bank.account_name": "SEED_BANK_ACCOUNT_NAME",
  "bank.account_number": "SEED_BANK_ACCOUNT_NUMBER",
  "bank.bank_name": "SEED_BANK_NAME",
};

/** A read never invents a value. Absence is typed, not an empty string. */
export type SettingValue =
  { present: true; value: string; origin: Exclude<SettingOrigin, "unset"> } | { present: false };

type SettingRow = { key: string; value: string | null; origin: SettingOrigin };

export async function readSetting(key: SettingKey): Promise<SettingValue> {
  const row = await queryOne<SettingRow>("SELECT key, value, origin FROM setting WHERE key = $1", [
    key,
  ]);
  if (row === null || row.value === null || row.value === "" || row.origin === "unset") {
    return { present: false };
  }
  return { present: true, value: row.value, origin: row.origin };
}

/** Absent is a value here, so a caller never has to handle `undefined` as well. */
export const ABSENT: SettingValue = { present: false };

export function pick(settings: Map<SettingKey, SettingValue>, key: SettingKey): SettingValue {
  return settings.get(key) ?? ABSENT;
}

export async function readSettings(
  keys: readonly SettingKey[],
): Promise<Map<SettingKey, SettingValue>> {
  const rows = await query<SettingRow>(
    "SELECT key, value, origin FROM setting WHERE key = ANY($1)",
    [keys],
  );
  const found = new Map(rows.map((row) => [row.key, row]));
  const result = new Map<SettingKey, SettingValue>();
  for (const key of keys) {
    const row = found.get(key);
    result.set(
      key,
      row === undefined || row.value === null || row.value === "" || row.origin === "unset"
        ? { present: false }
        : { present: true, value: row.value, origin: row.origin },
    );
  }
  return result;
}

/**
 * Seeds keys that have no value yet from the environment. Safe to run on every
 * boot: the WHERE clause means it can never overwrite an admin-set value, so a
 * redeploy cannot clobber what someone configured in the UI.
 */
export async function seedSettingsFromEnvironment(
  environment: NodeJS.ProcessEnv = process.env,
): Promise<SettingKey[]> {
  const seeded: SettingKey[] = [];
  for (const [key, variable] of Object.entries(ENVIRONMENT_SEEDS) as [SettingKey, string][]) {
    const value = environment[variable]?.trim();
    if (!value) continue;
    const rows = await query<{ key: string }>(
      `INSERT INTO setting (key, value, origin)
            VALUES ($1, $2, 'environment')
       ON CONFLICT (key) DO UPDATE
            SET value = excluded.value,
                origin = 'environment',
                updated_at = now()
          WHERE setting.origin <> 'admin'
            AND (setting.value IS NULL OR setting.value = '')
       RETURNING key`,
      [key, value],
    );
    if (rows.length > 0) seeded.push(key);
  }
  return seeded;
}

/**
 * An admin edit takes ownership of the key permanently. After this the environment
 * seed is inert for that key, which is the behaviour that makes the two sources
 * cooperate instead of fighting.
 */
export async function writeSetting(
  tx: Queryable,
  key: SettingKey,
  value: string | null,
  staffId: string,
) {
  await tx.query(
    `INSERT INTO setting (key, value, origin, updated_by, updated_at)
          VALUES ($1, $2, 'admin', $3, now())
     ON CONFLICT (key) DO UPDATE
          SET value = excluded.value,
              origin = 'admin',
              updated_by = excluded.updated_by,
              updated_at = now()`,
    [key, value, staffId],
  );
  await syncAdminSearchDocument(tx, "setting", key);
}

/**
 * Writes several settings in one transaction with one audit record, for a single
 * admin form submission (the bank details screen edits three keys at once, for
 * instance). Per-key writes still use `writeSetting` directly where only one
 * value changes.
 */
export async function writeSettings(
  entries: Partial<Record<SettingKey, string | null>>,
  actor: { staffId: string },
) {
  return withTransaction(async (tx) => {
    for (const [key, value] of Object.entries(entries) as [SettingKey, string | null][]) {
      await writeSetting(tx, key, value, actor.staffId);
    }
    await recordAudit(tx, {
      actorType: "staff",
      actorId: actor.staffId,
      action: "settings.updated",
      entityType: "setting",
      entityId: Object.keys(entries).join(","),
      after: entries,
    });
  });
}
