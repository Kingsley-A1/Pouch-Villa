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
