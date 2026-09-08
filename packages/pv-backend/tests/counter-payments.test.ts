import { beforeEach, describe, expect, it, vi } from "vitest";

const queryOne = vi.fn();
const query = vi.fn();
const withTransaction = vi.fn();
const recordAudit = vi.fn();
const syncPaymentSearchDocumentsForOrder = vi.fn();
const transitionOrder = vi.fn();

vi.mock("../src/db/client", () => ({ query, queryOne }));
vi.mock("../src/db/transaction", () => ({ withTransaction }));
vi.mock("../src/services/audit", () => ({ recordAudit }));
vi.mock("../src/services/admin-search-index", () => ({ syncPaymentSearchDocumentsForOrder }));
vi.mock("../src/services/orders", () => ({ transitionOrder }));

const {
  recordCounterPayment,
  OrderNotPayableError,
  PaymentAlreadySettledError,
  OrderNotFoundError,
} = await import("../src/services/counter-payments");

/**
 * Money taken at a counter, which is the one path here where getting it wrong
 * costs the client real cash rather than a bad screen.
 */

const ORDER = {
  id: "order-1",
  reference: "PV-7Q4K2M",
  status: "awaiting_payment",
  total_kobo: "1250000",
  contact_email: "ada@test.invalid",
  contact_name: "Ada Okafor",
};

/** A transaction that runs its body against a stub, recording every statement. */
function transactionRecording(
  statements: { sql: string; values: unknown[] }[],
  rowsFor: (sql: string) => unknown[],
) {
  return async (
    body: (tx: {
      query: (sql: string, values: unknown[]) => Promise<{ rows: unknown[] }>;
    }) => Promise<unknown>,
  ) =>
    body({
      query: async (sql: string, values: unknown[]) => {
        statements.push({ sql, values });
        return { rows: rowsFor(sql) };
      },
    });
}

beforeEach(() => {
  vi.clearAllMocks();
  queryOne.mockResolvedValue(ORDER);
});

describe("recordCounterPayment", () => {
  it("settles the payment row with what the money actually arrived as", async () => {
    const statements: { sql: string; values: unknown[] }[] = [];
    withTransaction.mockImplementation(
      transactionRecording(statements, (sql) =>
        sql.includes("settled_method") ? [{ id: "pay-1" }] : [],
      ),
    );

    const result = await recordCounterPayment(
      { orderId: "order-1", method: "cash", note: "till 2" },
      { staffId: "staff-1" },
    );

    const settle = statements.find((statement) => statement.sql.includes("settled_method"));
    expect(settle).toBeDefined();
    expect(settle?.values).toContain("cash");
    expect(settle?.values).toContain("staff-1");
    expect(result.reference).toBe("PV-7Q4K2M");
    expect(result.amountKobo).toBe(1250000);
  });

  it("advances the order, so the customer sees the payment land", async () => {
    withTransaction.mockImplementation(
      transactionRecording([], (sql) => (sql.includes("settled_method") ? [{ id: "pay-1" }] : [])),
    );

    await recordCounterPayment({ orderId: "order-1", method: "pos_card" }, { staffId: "staff-1" });

    expect(transitionOrder).toHaveBeenCalledWith("order-1", "payment_confirmed", {
      type: "staff",
      id: "staff-1",
    });
  });

  it("clears a proof left pending, so a paid order leaves the queue", async () => {
    const statements: { sql: string; values: unknown[] }[] = [];
    withTransaction.mockImplementation(
      transactionRecording(statements, (sql) =>
        sql.includes("settled_method") ? [{ id: "pay-1" }] : [],
      ),
    );

    await recordCounterPayment({ orderId: "order-1", method: "cash" }, { staffId: "staff-1" });

    expect(statements.some((statement) => statement.sql.includes("payment_proof"))).toBe(true);
  });

  it("writes an audit record naming the method", async () => {
    withTransaction.mockImplementation(
      transactionRecording([], (sql) => (sql.includes("settled_method") ? [{ id: "pay-1" }] : [])),
    );

    await recordCounterPayment({ orderId: "order-1", method: "cash" }, { staffId: "staff-1" });

    expect(recordAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: "payment.recorded_at_counter",
        after: expect.objectContaining({ method: "cash" }),
      }),
    );
  });

  it("refuses an order that is already paid rather than taking the money twice", async () => {
    // No payment row is outstanding, so the conditional UPDATE matches nothing.
    withTransaction.mockImplementation(transactionRecording([], () => []));

    await expect(
      recordCounterPayment({ orderId: "order-1", method: "cash" }, { staffId: "staff-1" }),
    ).rejects.toThrow(PaymentAlreadySettledError);
    expect(transitionOrder).not.toHaveBeenCalled();
  });

  it("refuses an order that has moved past taking payment", async () => {
    queryOne.mockResolvedValue({ ...ORDER, status: "completed" });

    await expect(
      recordCounterPayment({ orderId: "order-1", method: "cash" }, { staffId: "staff-1" }),
    ).rejects.toThrow(OrderNotPayableError);
    expect(withTransaction).not.toHaveBeenCalled();
  });

  it("takes payment against an order whose proof is still under review", async () => {
    queryOne.mockResolvedValue({ ...ORDER, status: "proof_submitted" });
    withTransaction.mockImplementation(
      transactionRecording([], (sql) => (sql.includes("settled_method") ? [{ id: "pay-1" }] : [])),
    );

    await expect(
      recordCounterPayment({ orderId: "order-1", method: "cash" }, { staffId: "staff-1" }),
    ).resolves.toMatchObject({ method: "cash" });
  });

  it("refuses an order that does not exist", async () => {
    queryOne.mockResolvedValue(null);

    await expect(
      recordCounterPayment({ orderId: "missing", method: "cash" }, { staffId: "staff-1" }),
    ).rejects.toThrow(OrderNotFoundError);
  });

  it("records what was taken, not what the customer said they would bring", async () => {
    const statements: { sql: string; values: unknown[] }[] = [];
    withTransaction.mockImplementation(
      transactionRecording(statements, (sql) =>
        sql.includes("settled_method") ? [{ id: "pay-1" }] : [],
      ),
    );

    // The order's stated preference is irrelevant here — only the argument counts.
    await recordCounterPayment({ orderId: "order-1", method: "pos_card" }, { staffId: "staff-1" });

    const settle = statements.find((statement) => statement.sql.includes("settled_method"));
    expect(settle?.values).toContain("pos_card");
  });
});
