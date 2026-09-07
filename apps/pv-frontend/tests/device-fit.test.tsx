import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { DeviceFit } from "@/components/device-fit";

const apple = (id: string, name: string, lineName: string | null) => ({
  id,
  slug: name.toLowerCase().replaceAll(" ", "-"),
  name,
  brandName: "Apple",
  lineName,
});

/**
 * The product page's "fits these devices". Classes group it; the query orders
 * it by the sort order set on the classes screen, so this must split the run
 * without re-sorting.
 */
describe("device fit", () => {
  afterEach(cleanup);

  it("says nothing rather than claiming a product fits everything", () => {
    const { container } = render(<DeviceFit devices={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("heads each class, in the order it was handed", () => {
    render(
      <DeviceFit
        devices={[
          apple("1", "iPhone 17", "iPhone"),
          apple("2", "iPad Pro", "iPad"),
          apple("3", "iPad Air", "iPad"),
        ]}
      />,
    );

    const headings = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
    expect(headings).toEqual(["iPhone", "iPad"]);
  });

  /** A make nobody has sorted must look exactly as it did before classes. */
  it("draws no heading for models with no class", () => {
    render(<DeviceFit devices={[apple("1", "iPhone 17", null)]} />);

    expect(screen.queryAllByRole("heading", { level: 3 })).toHaveLength(0);
    expect(screen.getByRole("link", { name: /iPhone 17/ })).toBeVisible();
  });

  it("still links every model to what fits it", () => {
    render(
      <DeviceFit devices={[apple("1", "iPhone 17", "iPhone"), apple("2", "iPad Air", "iPad")]} />,
    );

    expect(screen.getByRole("link", { name: /iPhone 17/ })).toHaveAttribute(
      "href",
      "/shop?device=iphone-17",
    );
    expect(screen.getByRole("link", { name: /iPad Air/ })).toHaveAttribute(
      "href",
      "/shop?device=ipad-air",
    );
  });

  it("asks about devices, not phones — the shop fits tablets now", () => {
    render(<DeviceFit devices={[apple("1", "iPad Air", "iPad")]} />);
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Fits these devices");
  });
});
