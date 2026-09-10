import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProductForm } from "@/app/admin/(protected)/products/product-form";

vi.mock("@/app/admin/(protected)/products/media-picker", () => ({
  MIN_MEDIA: 0,
  MAX_MEDIA: 5,
  MediaPicker: () => null,
}));

const category = (id: string, name: string, parentId: string | null, fitsDevices: boolean) => ({
  id,
  parentId,
  name,
  slug: id,
  description: null,
  sortOrder: 0,
  isActive: true,
  fitsDevices,
  image: null,
});

/*
  Two sections shaped differently, and children under each. Names are the
  client's own; nothing in the source branches on them.
*/
const categories = [
  category("pouches", "Pouches", null, true),
  category("accessories", "Accessories", null, false),
  category("cables", "USB Cables", "accessories", false),
  category("power-banks", "Power Banks", "accessories", false),
];

const brands = [
  { id: "apple", name: "Apple", slug: "apple", sortOrder: 0, isActive: true, logo: null },
];

const devices = [
  {
    id: "d1",
    brandId: "apple",
    brandName: "Apple",
    name: "17 Pro",
    slug: "d1",
    releasedYear: null,
    sortOrder: 0,
    lineId: null,
    lineName: null,
  },
];

function renderForm(sections = categories) {
  return render(
    <ProductForm
      action={vi.fn(async () => ({ error: null }))}
      brands={brands}
      categories={sections}
      devices={devices}
      deviceLines={[]}
      collections={[]}
      submitLabel="Save"
    />,
  );
}

const sectionSelect = () => screen.getByLabelText("Section") as HTMLSelectElement;
const chooseSection = (value: string) => fireEvent.change(sectionSelect(), { target: { value } });

afterEach(cleanup);

/**
 * The client sells two kinds of thing and files them differently: a pouch is
 * defined by the phone it fits, an accessory by what it is. The section decides
 * which questions the form asks, and it reads that from the category rather than
 * from its name.
 */
describe("filing a product into a section", () => {
  it("asks for a make and a device list in a device-fitting section", () => {
    renderForm();
    chooseSection("pouches");

    expect(screen.queryByLabelText("Brand")).not.toBeNull();
    expect(screen.queryByText("Fits these devices")).not.toBeNull();
  });

  it("asks for a type instead, in a section that is not about devices", () => {
    renderForm();
    chooseSection("accessories");

    expect(screen.queryByLabelText("Type")).not.toBeNull();
    expect(screen.queryByLabelText("Brand")).toBeNull();
    expect(screen.queryByText("Fits these devices")).toBeNull();
  });

  it("offers only that section's own types", () => {
    renderForm();
    chooseSection("accessories");

    const options = [...(screen.getByLabelText("Type") as HTMLSelectElement).options].map(
      (option) => option.textContent,
    );
    expect(options).toEqual(["— None —", "USB Cables", "Power Banks"]);
  });

  it("offers no type control for a section that has none", () => {
    renderForm();
    chooseSection("pouches");
    expect(screen.queryByLabelText("Type")).toBeNull();
  });

  /**
   * Device fit and a type are the two shapes this form asks for, and they do
   * not mix on one product. Pouches manages its models under Admin → Devices,
   * never types, so the field must stay hidden there even if a category was
   * left as a child of a device-fitting section before this rule existed.
   */
  it("never offers a type control on a device-fitting section, even one with children", () => {
    const withStrayChild = [...categories, category("cases", "Cases", "pouches", true)];
    renderForm(withStrayChild);
    chooseSection("pouches");
    expect(screen.queryByLabelText("Type")).toBeNull();
  });

  it("clears the type when the section changes, so it cannot belong to the wrong one", () => {
    renderForm();
    chooseSection("accessories");
    fireEvent.change(screen.getByLabelText("Type"), { target: { value: "cables" } });
    expect((screen.getByLabelText("Type") as HTMLSelectElement).value).toBe("cables");

    chooseSection("pouches");
    chooseSection("accessories");
    expect((screen.getByLabelText("Type") as HTMLSelectElement).value).toBe("");
  });

  it("posts both choices as categoryIds, so the product files exactly as before", () => {
    renderForm();
    chooseSection("accessories");
    fireEvent.change(screen.getByLabelText("Type"), { target: { value: "power-banks" } });

    const posted = [...document.querySelectorAll('[name="categoryIds"]')].map(
      (node) => (node as HTMLSelectElement).value,
    );
    expect(posted).toEqual(["accessories", "power-banks"]);
  });

  /**
   * Hiding the make and the model list is right for an accessory, but on edit it
   * also means saving clears what was recorded. That must be on screen, not
   * something a person finds out afterwards.
   */
  it("says that device details are cleared rather than leaving it as an absence", () => {
    renderForm();
    chooseSection("accessories");
    expect(screen.getByText(/cleared when you save/i)).toBeTruthy();
  });

  it("keeps the device fields before a section is chosen", () => {
    renderForm();
    // The shape this form had before sections existed: the safe default for a
    // half-filled form is the one every product already used.
    expect(screen.queryByLabelText("Brand")).not.toBeNull();
  });
});

/**
 * A shop that has not created a category yet still has to be able to add its
 * first product. The section select was briefly `required` with nothing in it,
 * which is a box that cannot be answered and silently blocks the whole form —
 * caught by the create-product tests rather than by a person, which is the only
 * reason it never shipped.
 */
describe("a shop with no sections yet", () => {
  it("asks nothing about sections rather than blocking the form", () => {
    renderForm([]);

    expect(screen.queryByLabelText("Section")).toBeNull();
    const select = document.querySelector('select[name="categoryIds"]');
    expect(select?.hasAttribute("required")).not.toBe(true);
  });

  it("keeps the device fields, which is what every product used before", () => {
    renderForm([]);
    expect(screen.queryByLabelText("Brand")).not.toBeNull();
  });
});
