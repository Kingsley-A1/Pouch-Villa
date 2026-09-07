import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import axe from "axe-core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DeviceFinder } from "@/components/device-finder";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const devices = [
  { id: "1", slug: "iphone-13", name: "iPhone 13", brandName: "Apple" },
  { id: "2", slug: "iphone-13-pro", name: "iPhone 13 Pro", brandName: "Apple" },
  { id: "3", slug: "galaxy-a54", name: "Galaxy A54", brandName: "Samsung" },
];

function choose(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

function find() {
  fireEvent.click(screen.getByRole("button", { name: "Show what fits" }));
}

describe("device finder", () => {
  afterEach(() => {
    push.mockReset();
    cleanup();
  });

  it("renders nothing until staff have entered a device", () => {
    const { container } = render(<DeviceFinder devices={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("takes the shopper to what fits the brand and model they picked", () => {
    render(<DeviceFinder devices={devices} />);
    choose("Brand", "Samsung");
    choose("Model", "galaxy-a54");
    find();

    expect(push).toHaveBeenCalledWith("/shop?device=galaxy-a54");
  });

  it("narrows the models to the brand that was chosen", () => {
    render(<DeviceFinder devices={devices} />);
    choose("Brand", "Apple");

    const models = screen.getAllByRole("option").map((option) => option.textContent);
    expect(models).toContain("iPhone 13");
    expect(models).not.toContain("Galaxy A54");
  });

  /**
   * The brand select is an accelerant, not a gate. Without a script it does
   * nothing, so every model has to be reachable from the model select alone.
   */
  it("offers every model, grouped by brand, before a brand is chosen", () => {
    render(<DeviceFinder devices={devices} />);
    const model = screen.getByLabelText("Model");

    expect(model).not.toBeDisabled();
    expect(model.querySelectorAll("optgroup")).toHaveLength(2);
    expect(model.querySelectorAll("option[value]:not([value=''])")).toHaveLength(3);
  });

  /** The device is the only thing this form is allowed to say about the shop. */
  it("never submits the phone's maker as a product brand filter", () => {
    render(<DeviceFinder devices={devices} />);
    expect(screen.getByLabelText("Brand")).not.toHaveAttribute("name");
  });

  it("keeps the category a shopper was already browsing", () => {
    render(<DeviceFinder devices={devices} categorySlug="pouches" />);
    choose("Model", "galaxy-a54");
    find();

    expect(push).toHaveBeenCalledWith("/shop?category=pouches&device=galaxy-a54");
  });

  it("says which device is filtering, and offers a way out", () => {
    render(<DeviceFinder devices={devices} activeSlug="galaxy-a54" />);
    expect(screen.getByText(/Showing what fits your Samsung Galaxy A54/)).toBeVisible();
    expect(screen.getByRole("link", { name: "Show everything" })).toHaveAttribute("href", "/shop");
  });

  it("starts on the device the URL is already filtered by", () => {
    render(<DeviceFinder devices={devices} activeSlug="galaxy-a54" />);
    expect(screen.getByLabelText("Brand")).toHaveValue("Samsung");
    expect(screen.getByLabelText("Model")).toHaveValue("galaxy-a54");
  });

  /**
   * `.field` and `.button-primary` are plain unlayered rules in globals.css and
   * Tailwind's utilities live in `@layer utilities` — an unlayered declaration
   * beats a layered one whatever the order, so a `rounded-none` utility never
   * reaches either and the corner stays round with nothing to show for it.
   * Measured in a browser: `rounded-none` resolves to 13.6px on both.
   *
   * These pin the classes that actually work, because the failure is silent.
   */
  it("squares the pickers with the class that beats the cascade", () => {
    render(<DeviceFinder devices={devices} />);

    for (const label of ["Brand", "Model"]) {
      expect(screen.getByLabelText(label).className).toContain("field-square");
    }
    expect(screen.getByRole("button", { name: "Show what fits" }).className).toContain(
      "button-square",
    );
  });

  it("owns its own measure and centres itself", () => {
    const { container } = render(<DeviceFinder devices={devices} />);
    const form = container.querySelector("form");

    expect(form?.className).toContain("mx-auto");
    expect(form?.className).toContain("max-w-md");
    expect(form?.className).toContain("rounded-none");
  });

  it("asks about a device, not a phone — the shop fits tablets too", () => {
    render(<DeviceFinder devices={devices} />);
    expect(screen.getByText("Find what fits your device")).toBeVisible();
  });

  /**
   * Device classes. Apple sells iPhones and iPads, so one flat list of thirty
   * Apple models is a dropdown nobody reads.
   */
  describe("device classes", () => {
    const classed = [
      { id: "1", slug: "iphone-15", name: "iPhone 15", brandName: "Apple", lineName: "iPhone" },
      { id: "2", slug: "ipad-air", name: "iPad Air", brandName: "Apple", lineName: "iPad" },
      { id: "3", slug: "galaxy-a54", name: "Galaxy A54", brandName: "Samsung", lineName: null },
    ];

    it("groups a brand's models under their class", () => {
      const { container } = render(<DeviceFinder devices={classed} />);
      const labels = [...container.querySelectorAll("optgroup")].map((group) =>
        group.getAttribute("label"),
      );

      expect(labels).toContain("Apple iPhone");
      expect(labels).toContain("Apple iPad");
    });

    /** A brand nobody has sorted must look exactly as it did. */
    it("leaves an unsorted brand flat, with no empty class heading", () => {
      const { container } = render(<DeviceFinder devices={classed} />);
      const labels = [...container.querySelectorAll("optgroup")].map((group) =>
        group.getAttribute("label"),
      );

      expect(labels).toContain("Samsung");
      expect(labels.some((label) => label?.includes("null"))).toBe(false);
    });

    it("still reaches every model, classed or not", () => {
      render(<DeviceFinder devices={classed} />);
      // Scoped to the model select: the brand select carries options too, and
      // matching the whole form picked those up as well.
      const values = [
        ...screen.getByLabelText("Model").querySelectorAll("option[value]:not([value=''])"),
      ].map((option) => option.getAttribute("value"));

      expect(values).toEqual(["iphone-15", "ipad-air", "galaxy-a54"]);
    });
  });

  it("has no automated accessibility violations", async () => {
    render(
      <main>
        <h1>Shop</h1>
        <DeviceFinder devices={devices} />
      </main>,
    );

    const result = await axe.run(document.body, {
      rules: { "color-contrast": { enabled: false } },
    });
    expect(result.violations).toEqual([]);
  });
});
