import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CategoryList } from "@/app/admin/(protected)/categories/category-list";

vi.mock("@/app/admin/(protected)/categories/actions", () => ({
  saveCategoryAction: vi.fn(),
  setCategoryActiveAction: vi.fn(),
  deleteCategoryAction: vi.fn(async () => ({ error: null })),
}));
vi.mock("@/app/admin/(protected)/categories/catalogue-image-field", () => ({
  CatalogueImageField: () => null,
}));

const category = (
  id: string,
  name: string,
  parentId: string | null,
  extra: { fitsDevices?: boolean; image?: unknown } = {},
) => ({
  id,
  parentId,
  name,
  slug: id,
  description: null,
  sortOrder: 0,
  isActive: true,
  fitsDevices: extra.fitsDevices ?? true,
  image: extra.image ?? null,
});

const categories = [
  category("pouches", "Pouches", null, { fitsDevices: true }),
  category("accessories", "Accessories", null, { fitsDevices: false }),
  category("power-banks", "Power Banks", "accessories"),
  category("cables", "USB Cables", "accessories"),
];

/**
 * The section's own card, matched on its heading rather than on any text.
 *
 * A plain text query picks up the name again inside an open form ("Added under
 * Accessories") and inside the button's own screen-reader label, so it has to be
 * anchored to the element that actually names the section.
 */
function sectionCard(name: string): HTMLElement {
  const heading = [...document.querySelectorAll("li > div > div > p.font-bold")].find((node) =>
    node.textContent?.trim().startsWith(name),
  );
  if (heading === undefined) throw new Error(`No section card called ${name}`);
  return heading.closest("li") as HTMLElement;
}

afterEach(cleanup);

/**
 * The screen where a section's shape is set — how it is browsed, whether it is
 * shown at all. What it stocks (a section's types) moved to its own page: see
 * `types-admin.test.tsx`. These pin that the move actually happened, not just
 * that a new page exists — a stray "Add type" left behind here would be the
 * same confusing screen the client reported, one control at a time.
 */
describe("the categories screen", () => {
  it("says how each section is browsed, in words", () => {
    render(<CategoryList categories={categories as never} />);

    expect(within(sectionCard("Pouches")).getByText("Browsed by device")).toBeTruthy();
    expect(within(sectionCard("Accessories")).getByText("Browsed by type")).toBeTruthy();
  });

  /**
   * The live bug this exists to make visible: a section left on "by device"
   * goes on asking shoppers which phone they own, with nothing on this screen
   * to say so.
   */
  it("shows a by-device section as such even when it has children", () => {
    const misfiled = [
      category("accessories", "Accessories", null, { fitsDevices: true }),
      category("cables", "USB Cables", "accessories"),
    ];
    render(<CategoryList categories={misfiled as never} />);

    expect(within(sectionCard("Accessories")).getByText("Browsed by device")).toBeTruthy();
  });

  /**
   * The thing the client asked to see removed. Pouches is browsed by device
   * and has no use for a type, so nothing about types — no button, no count,
   * no link — belongs on its card at all.
   */
  it("shows nothing about types on a device-fitting section", () => {
    render(<CategoryList categories={categories as never} />);

    const pouches = sectionCard("Pouches");
    expect(within(pouches).queryByText(/type/i)).toBeNull();
  });

  it("links a by-type section to where its types are managed, with a running count", () => {
    render(<CategoryList categories={categories as never} />);

    const link = within(sectionCard("Accessories")).getByRole("link", { name: /2 types/i });
    expect(link.getAttribute("href")).toBe("/admin/categories/types");
  });

  it("says so when a by-type section has none yet, and still links out", () => {
    const empty = [category("accessories", "Accessories", null, { fitsDevices: false })];
    render(<CategoryList categories={empty as never} />);

    const link = within(sectionCard("Accessories")).getByRole("link", { name: /no types yet/i });
    expect(link.getAttribute("href")).toBe("/admin/categories/types");
  });

  it("carries no way to add, edit or remove a type from this screen", () => {
    render(<CategoryList categories={categories as never} />);

    expect(screen.queryByRole("button", { name: /add type/i })).toBeNull();
    // The types themselves — Power Banks, USB Cables — are not listed here at
    // all; only the section that owns them and a link to where they live.
    expect(screen.queryByText("Power Banks")).toBeNull();
    expect(screen.queryByText("USB Cables")).toBeNull();
  });

  it("opens only one section form at a time", () => {
    render(<CategoryList categories={categories as never} />);
    fireEvent.click(screen.getByRole("button", { name: "Add section" }));
    fireEvent.click(within(sectionCard("Accessories")).getByRole("button", { name: "Edit" }));

    expect(document.querySelectorAll("form")).toHaveLength(1);
  });
});

/**
 * The client's report: the dashboard counted 76 categories, this screen showed
 * three sections, Accessories Types showed 26 — and the rest, filed under the
 * device-browsed sections, could not be listed, edited or removed from
 * anywhere. Nor could their sections, since a category with subcategories
 * cannot be removed.
 */
describe("what is filed under a device-browsed section", () => {
  const legacy = [
    category("cases", "Phone Cases", null, { fitsDevices: true }),
    category("iphone", "iPhone Cases", "cases"),
    category("iphone-17", "iPhone 17 Cases", "iphone"),
    category("samsung", "Samsung Cases", "cases"),
    category("accessories", "Accessories", null, { fitsDevices: false }),
    category("cables", "USB Cables", "accessories"),
  ];

  it("counts every one of them, at every depth", () => {
    render(<CategoryList categories={legacy as never} />);
    expect(within(sectionCard("Phone Cases")).getByText("3 subcategories")).toBeTruthy();
  });

  it("lists each, grandchildren included, with its own controls", () => {
    render(<CategoryList categories={legacy as never} />);
    const card = sectionCard("Phone Cases");

    for (const name of ["iPhone Cases", "iPhone 17 Cases", "Samsung Cases"]) {
      const row = within(card).getByText(name, { exact: false }).closest("li") as HTMLElement;
      expect(within(row).getByRole("button", { name: "Edit" })).toBeTruthy();
      expect(within(row).getByRole("button", { name: "Hide" })).toBeTruthy();
      expect(within(row).getByRole("button", { name: /remove/i })).toBeTruthy();
    }
  });

  it("keeps a branch together, each category followed by its own", () => {
    render(<CategoryList categories={legacy as never} />);
    const order = [...sectionCard("Phone Cases").querySelectorAll("[data-filter-label]")].map(
      (row) => row.getAttribute("data-filter-label"),
    );
    expect(order).toEqual(["iPhone Cases", "iPhone 17 Cases", "Samsung Cases"]);
  });

  it("opens an edit form for one of them, in place", () => {
    render(<CategoryList categories={legacy as never} />);
    const row = within(sectionCard("Phone Cases"))
      .getByText("Samsung Cases")
      .closest("li") as HTMLElement;
    fireEvent.click(within(row).getByRole("button", { name: "Edit" }));

    const form = row.querySelector("form");
    expect(form).not.toBeNull();
    expect((form?.querySelector('input[name="id"]') as HTMLInputElement).value).toBe("samsung");
  });

  /**
   * Moving a category under itself or under one of its own leaves the whole
   * branch with no top level — gone from every list again. The server refuses
   * it; the dropdown should not offer it.
   */
  it("never offers a category's own branch as its new parent", () => {
    render(<CategoryList categories={legacy as never} />);
    const row = within(sectionCard("Phone Cases"))
      .getByText("iPhone Cases")
      .closest("li") as HTMLElement;
    fireEvent.click(within(row).getByRole("button", { name: "Edit" }));

    const options = [
      ...(document.querySelector('select[name="parentId"]') as HTMLSelectElement).options,
    ].map((option) => option.value);
    expect(options).not.toContain("iphone");
    expect(options).not.toContain("iphone-17");
    expect(options).toContain("samsung");
  });

  it("says nothing about subcategories on a device section that has none", () => {
    render(<CategoryList categories={categories as never} />);
    expect(within(sectionCard("Pouches")).queryByText(/subcategor/i)).toBeNull();
  });
});
