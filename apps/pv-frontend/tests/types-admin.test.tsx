import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TypeList } from "@/app/admin/(protected)/categories/types/type-list";

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

function sectionCard(name: string): HTMLElement {
  const heading = [...document.querySelectorAll("li > div > div > p.font-bold")].find((node) =>
    node.textContent?.trim().startsWith(name),
  );
  if (heading === undefined) throw new Error(`No section card called ${name}`);
  return heading.closest("li") as HTMLElement;
}

afterEach(cleanup);

/**
 * Where a by-type section's own types are added, edited, hidden and removed —
 * moved here from Brands & Categories so the frequent job of stocking a section
 * is not buried under the rare one of shaping the shop. Reads and writes the
 * same category rows through the same `CategoryForm` and server actions as
 * before; only where the controls live has moved.
 */
describe("the types screen", () => {
  it("shows only sections that are browsed by type", () => {
    render(<TypeList categories={categories as never} />);

    expect(screen.queryByText("Pouches")).toBeNull();
    expect(screen.getByText("Accessories")).toBeTruthy();
  });

  it("says when no section is browsed by type at all, and points at how to change one", () => {
    const noneByType = [category("pouches", "Pouches", null, { fitsDevices: true })];
    render(<TypeList categories={noneByType as never} />);

    const link = screen.getByRole("link", { name: "Brands & Categories" });
    expect(link.getAttribute("href")).toBe("/admin/categories");
  });

  it("gives its section its own add-type button", () => {
    render(<TypeList categories={categories as never} />);
    expect(
      within(sectionCard("Accessories")).getByRole("button", { name: "Add a type to Accessories" }),
    ).toBeTruthy();
  });

  it("fixes the parent to the section the button belongs to", () => {
    render(<TypeList categories={categories as never} />);
    fireEvent.click(
      within(sectionCard("Accessories")).getByRole("button", { name: "Add a type to Accessories" }),
    );

    // Carried as a value, not a dropdown that could contradict the button used.
    const parent = document.querySelector('input[name="parentId"]') as HTMLInputElement;
    expect(parent?.value).toBe("accessories");
    expect(document.querySelector('select[name="parentId"]')).toBeNull();
  });

  it("lists a section's types, and counts them", () => {
    render(<TypeList categories={categories as never} />);

    const accessories = sectionCard("Accessories");
    expect(within(accessories).getByText("2 types")).toBeTruthy();
    expect(within(accessories).getByText("Power Banks")).toBeTruthy();
    expect(within(accessories).getByText("USB Cables")).toBeTruthy();
  });

  it("flags a type that has no picture, and stays quiet about one that has", () => {
    render(<TypeList categories={categories as never} />);

    const accessories = sectionCard("Accessories");
    const cables = within(accessories).getByText("USB Cables").closest("div") as HTMLElement;
    expect(cables.textContent).toContain("no picture yet");

    const powerBanks = within(accessories).getByText("Power Banks").closest("div") as HTMLElement;
    expect(powerBanks.textContent).not.toContain("no picture yet");
  });

  it("opens one form at a time", () => {
    render(<TypeList categories={categories as never} />);
    const accessories = sectionCard("Accessories");
    fireEvent.click(within(accessories).getByRole("button", { name: "Add a type to Accessories" }));
    fireEvent.click(within(accessories).getAllByRole("button", { name: "Edit" })[0]!);

    expect(document.querySelectorAll("form")).toHaveLength(1);
  });
});
