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

function type(value: string) {
  fireEvent.change(screen.getByRole("combobox"), { target: { value } });
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

  it("narrows the list as a model is typed", () => {
    render(<DeviceFinder devices={devices} />);
    type("iphone 13 pro");

    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(1);
    expect(options[0]).toHaveTextContent("iPhone 13 Pro");
  });

  it("takes the shopper to what fits the device they pick", () => {
    render(<DeviceFinder devices={devices} />);
    type("a54");
    fireEvent.click(screen.getByRole("option", { name: /Galaxy A54/ }));

    expect(push).toHaveBeenCalledWith("/shop?device=galaxy-a54");
  });

  it("keeps the category a shopper was already browsing", () => {
    render(<DeviceFinder devices={devices} categorySlug="pouches" />);
    type("a54");
    fireEvent.click(screen.getByRole("option", { name: /Galaxy A54/ }));

    expect(push).toHaveBeenCalledWith("/shop?category=pouches&device=galaxy-a54");
  });

  /**
   * Free text must never navigate. Guessing would send someone to an empty shop
   * and present it as a result about their phone.
   */
  it("does not navigate on Enter when nothing matches", () => {
    render(<DeviceFinder devices={devices} />);
    type("nokia 3310");
    fireEvent.keyDown(screen.getByRole("combobox"), { key: "Enter" });

    expect(push).not.toHaveBeenCalled();
    expect(screen.getByText(/No match for/)).toBeVisible();
  });

  it("is drivable from the keyboard alone", () => {
    render(<DeviceFinder devices={devices} />);
    const field = screen.getByRole("combobox");
    type("iphone");
    fireEvent.keyDown(field, { key: "ArrowDown" });
    fireEvent.keyDown(field, { key: "Enter" });

    expect(push).toHaveBeenCalledWith("/shop?device=iphone-13-pro");
  });

  it("says which device is filtering, and offers a way out", () => {
    render(<DeviceFinder devices={devices} activeSlug="galaxy-a54" />);
    expect(screen.getByText(/Showing what fits your Samsung Galaxy A54/)).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Show every device" }));
    expect(push).toHaveBeenCalledWith("/shop");
  });

  it("has no automated accessibility violations with the list open", async () => {
    render(
      <main>
        <h1>Shop</h1>
        <DeviceFinder devices={devices} />
      </main>,
    );
    type("iphone");

    const result = await axe.run(document.body, {
      rules: { "color-contrast": { enabled: false } },
    });
    expect(result.violations).toEqual([]);
  });
});
