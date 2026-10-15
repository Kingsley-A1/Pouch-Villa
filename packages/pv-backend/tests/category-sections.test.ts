import { beforeEach, describe, expect, it, vi } from "vitest";
import { categorySchema } from "../src/domain/schemas";

const queryOne = vi.fn();

vi.mock("../src/db/client", () => ({ query: vi.fn(), queryOne, withTransaction: vi.fn() }));
const txQuery = vi.fn();
vi.mock("../src/db/transaction", () => ({
  withTransaction: vi.fn(async (body: (tx: { query: typeof txQuery }) => unknown) =>
    body({ query: txQuery }),
  ),
}));
vi.mock("../src/services/audit", () => ({ recordAudit: vi.fn() }));
vi.mock("../src/services/admin-search-index", () => ({ syncAdminSearchDocument: vi.fn() }));

const { rootFitsDevices, updateCategory } = await import("../src/services/categories");

/**
 * The one setting that decides whether a section is filed and browsed by the
 * device a product fits, or by what the product is.
 *
 * It is a category row rather than a name check on purpose — AGENTS.md section 4
 * forbids a category list in source, and a rule reading `name = 'Accessories'`
 * would break the day the client renames it.
 */

beforeEach(() => vi.clearAllMocks());

describe("the section setting", () => {
  it("defaults to fitting devices, so every category that already exists is unchanged", () => {
    const parsed = categorySchema.parse({
      parentId: null,
      name: "Pouches",
      description: null,
      sortOrder: 0,
    });
    expect(parsed.fitsDevices).toBe(true);
  });

  it("takes a false the caller actually sent", () => {
    const parsed = categorySchema.parse({
      parentId: null,
      name: "Accessories",
      description: null,
      sortOrder: 1,
      fitsDevices: false,
    });
    expect(parsed.fitsDevices).toBe(false);
  });
});

describe("rootFitsDevices", () => {
  it("answers from the root, so a child follows its section", async () => {
    queryOne.mockResolvedValue({ fits_devices: false });
    await expect(rootFitsDevices("screen-protectors")).resolves.toBe(false);

    // The walk is up `parent_id` and stops at the row with none.
    const sql = String(queryOne.mock.calls[0]?.[0]);
    expect(sql).toContain("WITH RECURSIVE");
    expect(sql).toContain("parent_id IS NULL");
  });

  it("falls back to fitting devices for a category it cannot find", async () => {
    // The shape every category had before the column existed: an unknown id
    // degrades to the old form rather than to one the admin has never seen.
    queryOne.mockResolvedValue(null);
    await expect(rootFitsDevices("missing")).resolves.toBe(true);
  });
});

/**
 * Every category is now editable from the admin, parent dropdown included, so
 * nothing in the UI alone stops someone filing "Cases" under one of its own
 * subcategories. The server has to: that loop has no top level, and the whole
 * branch would vanish from every list while still being counted.
 */
describe("moving a category", () => {
  const input = {
    parentId: "grandchild",
    name: "Cases",
    description: null,
    sortOrder: 0,
    fitsDevices: true,
  };

  it("refuses to file a category under its own subcategory", async () => {
    txQuery
      .mockResolvedValueOnce({ rows: [{ parent_id: null }] }) // the row before the edit
      .mockResolvedValueOnce({ rows: [{ "?column?": 1 }] }); // its ancestry reaches itself

    await expect(updateCategory("cases", input, { staffId: "s1" })).rejects.toMatchObject({
      name: "CategoryCycleError",
    });
    // Rejected before anything was written.
    expect(txQuery).toHaveBeenCalledTimes(2);
    expect(String(txQuery.mock.calls[1]?.[0])).toContain("WITH RECURSIVE");
    expect(txQuery.mock.calls[1]?.[1]).toEqual(["grandchild", "cases"]);
  });

  it("saves a move to an unrelated parent", async () => {
    txQuery
      .mockResolvedValueOnce({ rows: [{ parent_id: null }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValue({ rows: [] });

    await expect(updateCategory("cases", input, { staffId: "s1" })).resolves.toBe(true);
    expect(String(txQuery.mock.calls[2]?.[0])).toContain("UPDATE category");
  });

  it("skips the check for a move to the top level", async () => {
    txQuery.mockResolvedValue({ rows: [{ parent_id: "x" }] });

    await updateCategory("cases", { ...input, parentId: null }, { staffId: "s1" });
    expect(txQuery.mock.calls.some((call) => String(call[0]).includes("RECURSIVE"))).toBe(false);
  });
});
