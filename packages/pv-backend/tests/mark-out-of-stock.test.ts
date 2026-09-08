import { beforeEach, describe, expect, it, vi } from "vitest";

const withTransaction = vi.fn();
const recordAudit = vi.fn();

vi.mock("../src/db/transaction", () => ({ withTransaction }));
vi.mock("../src/db/client", () => ({ query: vi.fn(), queryOne: vi.fn() }));
vi.mock("../src/services/audit", () => ({ recordAudit }));
vi.mock("../src/services/admin-search-index", () => ({ syncAdminSearchDocument: vi.fn() }));

const { markProductOutOfStock, NothingInStockError } = await import("../src/services/products");

/** Runs the transaction body against a stub, recording what it sent. */
function transactionReturning(
  rows: unknown[],
  statements: { sql: string; values: unknown[] }[] = [],
) {
  return async (
    body: (tx: {
      query: (sql: string, values: unknown[]) => Promise<{ rows: unknown[] }>;
    }) => Promise<unknown>,
  ) =>
    body({
      query: async (sql: string, values: unknown[]) => {
        statements.push({ sql, values });
        return { rows };
      },
    });
}

beforeEach(() => vi.clearAllMocks());

describe("markProductOutOfStock", () => {
  it("reports how many variants it zeroed", async () => {
    withTransaction.mockImplementation(
      transactionReturning([{ variant_id: "v1" }, { variant_id: "v2" }]),
    );

    await expect(markProductOutOfStock("product-1", { staffId: "staff-1" })).resolves.toBe(2);
  });

  it("writes ledger entries rather than setting a counter", async () => {
    const statements: { sql: string; values: unknown[] }[] = [];
    withTransaction.mockImplementation(transactionReturning([{ variant_id: "v1" }], statements));

    await markProductOutOfStock("product-1", { staffId: "staff-1" });

    const written = statements[0]?.sql ?? "";
    expect(written).toContain("INSERT INTO stock_entry");
    // The negation is what makes it a ledger entry that cancels the holding,
    // rather than a write of the number zero.
    expect(written).toContain("-held.quantity");
    expect(written).not.toMatch(/UPDATE\s+product_variant/i);
  });

  it("only touches variants that actually hold stock", async () => {
    const statements: { sql: string; values: unknown[] }[] = [];
    withTransaction.mockImplementation(transactionReturning([{ variant_id: "v1" }], statements));

    await markProductOutOfStock("product-1", { staffId: "staff-1" });

    // An oversold variant sitting below zero must not be topped back up to it.
    expect(statements[0]?.sql).toContain("held.quantity > 0");
  });

  it("refuses when nothing was in stock, so a press that did nothing says so", async () => {
    withTransaction.mockImplementation(transactionReturning([]));

    await expect(markProductOutOfStock("product-1", { staffId: "staff-1" })).rejects.toThrow(
      NothingInStockError,
    );
  });

  it("audits who emptied the shelf and by how much", async () => {
    withTransaction.mockImplementation(
      transactionReturning([{ variant_id: "v1" }, { variant_id: "v2" }]),
    );

    await markProductOutOfStock("product-1", { staffId: "staff-1" });

    expect(recordAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: "stock.marked_out_of_stock",
        actorId: "staff-1",
        entityId: "product-1",
        after: expect.objectContaining({ variantsZeroed: 2 }),
      }),
    );
  });

  it("derives the quantity inside the write, leaving no read-then-write gap", async () => {
    const statements: { sql: string; values: unknown[] }[] = [];
    withTransaction.mockImplementation(transactionReturning([{ variant_id: "v1" }], statements));

    await markProductOutOfStock("product-1", { staffId: "staff-1" });

    // One statement. A sale landing between a read and a write would otherwise
    // be subtracted twice.
    expect(statements).toHaveLength(1);
  });
});
