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
