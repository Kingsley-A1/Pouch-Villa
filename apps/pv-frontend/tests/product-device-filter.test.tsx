import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProductForm } from "@/app/admin/(protected)/products/product-form";

vi.mock("@/app/admin/(protected)/products/media-picker", () => ({
  MIN_MEDIA: 0,
  MAX_MEDIA: 5,
  MediaPicker: () => null,
}));

const brands = [
  { id: "apple", name: "Apple", slug: "apple", sortOrder: 0, isActive: true, logo: null },
  { id: "samsung", name: "Samsung", slug: "samsung", sortOrder: 1, isActive: true, logo: null },
];

const device = (id: string, name: string, brandId: string, lineId: string | null) => ({
  id,
  brandId,
  brandName: brandId === "apple" ? "Apple" : "Samsung",
  name,
  slug: id,
  releasedYear: null,
  sortOrder: 0,
  lineId,
  lineName: lineId === "iphone" ? "iPhone" : lineId === "ipad" ? "iPad" : null,
});

const devices = [
  device("d1", "17 Pro", "apple", "iphone"),
  device("d2", "iPad Air", "apple", "ipad"),
  device("d3", "Fold 7", "samsung", null),
];

const deviceLines = [
  {
    id: "iphone",
    brandId: "apple",
    brandName: "Apple",
    name: "iPhone",
    slug: "iphone",
    sortOrder: 0,
    deviceCount: 1,
  },
  {
    id: "ipad",
    brandId: "apple",
    brandName: "Apple",
    name: "iPad",
    slug: "ipad",
    sortOrder: 1,
    deviceCount: 1,
  },
];

function renderForm(editing?: { deviceIds: string[] }) {
  return render(
    <ProductForm
      action={vi.fn(async () => ({ error: null }))}
      brands={brands}
      categories={[]}
      devices={devices}
      deviceLines={deviceLines}
      collections={[]}
      submitLabel="Save"
      {...(editing
        ? {
            editing: {
              id: "p1",
              slug: "p",
              name: "Pouch",
              description: null,
              brandId: "apple",
              status: "draft" as const,
              categoryIds: [],
              deviceIds: editing.deviceIds,
              variants: [],
            },
          }
        : {})}
    />,
  );
}

const modelBoxes = () =>
  screen
    .getAllByRole("checkbox")
    .map((box) => box.closest("label")?.textContent?.trim())
    .filter((label): label is string => label !== undefined);

/**
 * The client's ask: choosing a make should narrow the compatibility list to
 * that make, not merely sort it. Every make at once meant every model the shop
 * knows, which made this a scroll rather than a choice.
 */
describe("product compatibility, narrowed by make", () => {
  afterEach(cleanup);

  it("offers every make while none is chosen", () => {
    renderForm();
    expect(modelBoxes()).toEqual(["Apple 17 Pro", "Apple iPad Air", "Samsung Fold 7"]);
  });

  it("narrows to the chosen make, and drops the make from each row", () => {
    renderForm();
    fireEvent.change(screen.getByLabelText("Brand"), { target: { value: "apple" } });

    expect(modelBoxes()).toEqual(["17 Pro", "iPad Air"]);
  });

  it("offers that make's classes, and narrows again when one is picked", () => {
    renderForm();
    fireEvent.change(screen.getByLabelText("Brand"), { target: { value: "apple" } });

    fireEvent.change(screen.getByLabelText("Device class"), { target: { value: "ipad" } });
    expect(modelBoxes()).toEqual(["iPad Air"]);
  });

  /** A make with no classes gets no control at all, rather than an empty select. */
  it("shows no class control for a make that has none", () => {
    renderForm();
    fireEvent.change(screen.getByLabelText("Brand"), { target: { value: "samsung" } });

    expect(screen.queryByLabelText("Device class")).toBeNull();
    expect(modelBoxes()).toEqual(["Fold 7"]);
  });

  /**
   * The trap this guards. An unchecked box posts nothing, so narrowing the list
   * on an edit would silently delete every tick outside the filter.
   */
  it("keeps saved ticks the filter is hiding, as hidden inputs", () => {
    const { container } = renderForm({ deviceIds: ["d1", "d3"] });
    fireEvent.change(screen.getByLabelText("Device class"), { target: { value: "ipad" } });

    const carried = [...container.querySelectorAll('input[type="hidden"][name="deviceIds"]')].map(
      (input) => input.getAttribute("value"),
    );
    expect(carried).toContain("d1");
    expect(carried).toContain("d3");
  });
});
