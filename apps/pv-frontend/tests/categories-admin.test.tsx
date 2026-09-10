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
  category("power-banks", "Power Banks", "accessories", {
    image: { cardUrl: "/p.jpg", thumbUrl: "/p.jpg", heroUrl: "/p.jpg", width: 8, height: 8 },
  }),
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
 * The screen where the shop's shape is set. Two things were invisible on it and
 * both cost the client real time: how a section is browsed, and how to add a
 * type without knowing that a type is a category with a parent.
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
  it("shows a by-device section as such even when it has types under it", () => {
    const misfiled = [
      category("accessories", "Accessories", null, { fitsDevices: true }),
      category("cables", "USB Cables", "accessories"),
    ];
    render(<CategoryList categories={misfiled as never} />);

    expect(within(sectionCard("Accessories")).getByText("Browsed by device")).toBeTruthy();
  });

  it("gives every section its own add-type button", () => {
    render(<CategoryList categories={categories as never} />);

    for (const name of ["Pouches", "Accessories"]) {
      expect(
        within(sectionCard(name)).getByRole("button", { name: `Add type to ${name}` }),
      ).toBeTruthy();
    }
  });

  it("fixes the parent to the section the button belongs to", () => {
    render(<CategoryList categories={categories as never} />);
    fireEvent.click(
      within(sectionCard("Accessories")).getByRole("button", { name: "Add type to Accessories" }),
    );

    // Carried as a value, not a dropdown that could contradict the button used.
    const parent = document.querySelector('input[name="parentId"]') as HTMLInputElement;
    expect(parent?.value).toBe("accessories");
    expect(document.querySelector('select[name="parentId"]')).toBeNull();
    // The form says which section it is adding to, so the fixed parent is not
    // a silent decision. Matched on the paragraph rather than an exact string,
    // because the section's name sits in its own element inside the sentence.
    const note = [...document.querySelectorAll("p")].find((node) =>
      node.textContent?.startsWith("Added under"),
    );
    expect(note?.textContent).toContain("Accessories");
  });

  it("nests a section's types under it, and counts them", () => {
    render(<CategoryList categories={categories as never} />);

    const accessories = sectionCard("Accessories");
    expect(within(accessories).getByText("2 types")).toBeTruthy();
    expect(within(accessories).getByText("Power Banks")).toBeTruthy();
    expect(within(accessories).getByText("USB Cables")).toBeTruthy();
    expect(within(sectionCard("Pouches")).getByText("No types yet")).toBeTruthy();
  });

  /**
   * A type with no photograph draws a lettered panel on the shop, and there was
   * no way to see which were still doing that short of opening each one.
   */
  it("flags a type that has no picture, and stays quiet about one that has", () => {
    render(<CategoryList categories={categories as never} />);

    const accessories = sectionCard("Accessories");
    const cables = within(accessories).getByText("USB Cables").closest("div") as HTMLElement;
    expect(cables.textContent).toContain("no picture yet");

    const powerBanks = within(accessories).getByText("Power Banks").closest("div") as HTMLElement;
    expect(powerBanks.textContent).not.toContain("no picture yet");
  });

  it("opens one form at a time", () => {
    render(<CategoryList categories={categories as never} />);
    fireEvent.click(screen.getByRole("button", { name: "Add section" }));
    fireEvent.click(
      within(sectionCard("Accessories")).getByRole("button", { name: "Add type to Accessories" }),
    );

    expect(document.querySelectorAll("form")).toHaveLength(1);
  });
});
