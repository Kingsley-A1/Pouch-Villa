import { beforeEach, describe, expect, it, vi } from "vitest";
import { deviceSchema, deviceLineSchema } from "../src/domain/schemas";

const withTransaction = vi.fn();
const recordAudit = vi.fn();
const syncAdminSearchDocument = vi.fn();

vi.mock("../src/db/transaction", () => ({ withTransaction }));
vi.mock("../src/db/client", () => ({ query: vi.fn(), queryOne: vi.fn() }));
vi.mock("../src/services/audit", () => ({ recordAudit }));
vi.mock("../src/services/admin-search-index", () => ({
  syncAdminSearchDocument,
  syncDeviceSearchDocumentsForBrand: vi.fn(),
}));

const { createDevice, updateDevice, deleteDeviceLine } = await import("../src/services/devices");

/**
 * The device class tier, end to end through the service.
 *
 * It had no coverage at all — `device-groups.test.ts` tests the pure grouping
 * helper and nothing touched the CRUD — so a class silently failing to save
 * would have been caught by a person using the admin rather than by CI. The
 * client reporting it as broken is exactly the failure that gap allows.
 */

type Statement = { sql: string; values: unknown[] };

/**
 * Runs the transaction body against a stub. `rows` answers every query, so the
 * class-membership lookup finds a row unless a test says otherwise.
 */
function transaction(statements: Statement[], rows: (sql: string) => unknown[]) {
  return async (
    body: (tx: {
      query: (sql: string, values?: unknown[]) => Promise<{ rows: unknown[] }>;
    }) => Promise<unknown>,
  ) =>
    body({
      query: async (sql: string, values: unknown[] = []) => {
        statements.push({ sql, values });
        return { rows: rows(sql) };
      },
    });
}

/** The class exists and belongs to the brand asked for. */
const classBelongsToBrand = (sql: string): unknown[] => {
  if (sql.includes("FROM device_line WHERE id")) return [{ id: "line-1" }];
  if (sql.includes("INSERT INTO device")) return [{ id: "device-1" }];
  if (sql.includes("SELECT brand_id, name, slug, released_year")) {
    return [{ brand_id: "brand-1", slug: "iphone-15", line_id: null }];
  }
  if (sql.includes("SELECT slug FROM device")) return [];
  return [];
};

beforeEach(() => vi.clearAllMocks());

describe("the class a device is filed under", () => {
  it("survives validation rather than being stripped", () => {
    const parsed = deviceSchema.parse({
      brandId: "11111111-1111-4111-8111-111111111111",
      name: "iPhone 15",
      releasedYear: null,
      sortOrder: 0,
      lineId: "22222222-2222-4222-8222-222222222222",
    });
    expect(parsed.lineId).toBe("22222222-2222-4222-8222-222222222222");
  });

  it("treats no class as a legitimate answer, not a missing field", () => {
    const parsed = deviceSchema.parse({
      brandId: "11111111-1111-4111-8111-111111111111",
      name: "Some Model",
      releasedYear: null,
      sortOrder: 0,
      lineId: null,
    });
    expect(parsed.lineId).toBeNull();
  });

  it("writes the class onto a new device", async () => {
    const statements: Statement[] = [];
    withTransaction.mockImplementation(transaction(statements, classBelongsToBrand));

    await createDevice(
      { brandId: "brand-1", name: "iPhone 15", releasedYear: null, sortOrder: 0, lineId: "line-1" },
      { staffId: "staff-1" },
    );

    const insert = statements.find((s) => s.sql.includes("INSERT INTO device "));
    expect(insert?.values).toContain("line-1");
  });

  it("writes the class onto an edited device", async () => {
    const statements: Statement[] = [];
    withTransaction.mockImplementation(transaction(statements, classBelongsToBrand));

    await updateDevice(
      "device-1",
      { brandId: "brand-1", name: "iPhone 15", releasedYear: null, sortOrder: 0, lineId: "line-1" },
      { staffId: "staff-1" },
    );

    const update = statements.find((s) => s.sql.includes("UPDATE device\n"));
    expect(update?.sql).toContain("line_id");
    expect(update?.values).toContain("line-1");
  });

  /**
   * The form can only offer the chosen brand's classes, so this is unreachable
   * through the admin — which is exactly why it belongs in the service (§3).
   */
  it("drops a class that belongs to a different brand rather than filing an iPad under Samsung", async () => {
    const statements: Statement[] = [];
    withTransaction.mockImplementation(
      transaction(statements, (sql) =>
        // The membership lookup finds nothing: this class is not this brand's.
        sql.includes("FROM device_line WHERE id") ? [] : classBelongsToBrand(sql),
      ),
    );

    await createDevice(
      {
        brandId: "brand-2",
        name: "Galaxy S24",
        releasedYear: null,
        sortOrder: 0,
        lineId: "line-1",
      },
      { staffId: "staff-1" },
    );

    const insert = statements.find((s) => s.sql.includes("INSERT INTO device "));
    expect(insert?.values).not.toContain("line-1");
    expect(insert?.values).toContain(null);
  });

  it("unfiles the models when a class is removed, rather than deleting them", async () => {
    const statements: Statement[] = [];
    withTransaction.mockImplementation(
      transaction(statements, (sql) =>
        sql.includes("UPDATE device_line SET deleted_at") ? [{ name: "iPad" }] : [],
      ),
    );

    await deleteDeviceLine("line-1", { staffId: "staff-1" });

    // Soft-deleted, and the models survive with their class cleared.
    expect(statements.some((s) => s.sql.includes("deleted_at = now()"))).toBe(true);
    const unfile = statements.find((s) => s.sql.includes("UPDATE device SET line_id = NULL"));
    expect(unfile).toBeDefined();
    expect(statements.some((s) => /DELETE\s+FROM\s+device\b/i.test(s.sql))).toBe(false);
  });
});

describe("the class itself", () => {
  it("requires a brand, because a class only exists under one", () => {
    const result = deviceLineSchema.safeParse({ name: "iPad", sortOrder: 0 });
    expect(result.success).toBe(false);
  });

  it("accepts a name and an order", () => {
    const parsed = deviceLineSchema.parse({
      brandId: "11111111-1111-4111-8111-111111111111",
      name: "iPad",
      sortOrder: 2,
    });
    expect(parsed).toMatchObject({ name: "iPad", sortOrder: 2 });
  });
});
